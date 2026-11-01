from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Account, Transaction, User
from ..schemas import AccountCreate, AccountOut, AccountUpdate
from ..serializers import account_out
from ..services import account_balances, account_transaction_counts, from_cents, to_cents

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


def _account_or_404(db: Session, user_id: int, account_id: int) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.user_id != user_id:
        raise HTTPException(status_code=404, detail="Conto non trovato")
    return account


@router.get("", response_model=list[AccountOut])
def list_accounts(
    include_archived: bool = True,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AccountOut]:
    query = select(Account).where(Account.user_id == user.id)
    if not include_archived:
        query = query.where(Account.archived.is_(False))
    accounts = db.scalars(query.order_by(Account.archived, Account.sort_order, Account.id)).all()
    balances = account_balances(db, user.id)
    counts = account_transaction_counts(db, user.id)
    return [account_out(account, balances.get(account.id, 0), counts.get(account.id, 0)) for account in accounts]


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccountOut:
    account = Account(
        user_id=user.id,
        name=payload.name.strip(),
        type=payload.type,
        initial_balance_cents=to_cents(payload.initial_balance),
        currency=user.currency,
        color=payload.color,
        icon=payload.icon,
        notes=payload.notes,
        archived=payload.archived,
        sort_order=payload.sort_order,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account_out(account, account.initial_balance_cents)


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(
    account_id: int,
    payload: AccountUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccountOut:
    account = _account_or_404(db, user.id, account_id)
    data = payload.model_dump(exclude_unset=True)
    if "initial_balance" in data and data["initial_balance"] is not None:
        data["initial_balance_cents"] = to_cents(data.pop("initial_balance"))
    if "color" in data and data["color"] is not None:
        color = data["color"].strip()
        if not color.startswith("#") or len(color) not in (4, 7):
            raise HTTPException(status_code=400, detail="Colore non valido")
        data["color"] = color
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    for field, value in data.items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    balances = account_balances(db, user.id)
    counts = account_transaction_counts(db, user.id)
    return account_out(account, balances.get(account.id, 0), counts.get(account.id, 0))


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    account = _account_or_404(db, user.id, account_id)
    used = db.scalar(
        select(func.count(Transaction.id)).where(
            Transaction.user_id == user.id,
            or_(
                Transaction.account_id == account_id,
                Transaction.transfer_account_id == account_id,
            ),
        )
    )
    if used:
        raise HTTPException(
            status_code=409,
            detail="Il conto ha movimenti collegati. Archivialo invece di eliminarlo.",
        )
    db.delete(account)
    db.commit()


@router.get("/{account_id}/balance")
def get_balance(
    account_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, float]:
    _account_or_404(db, user.id, account_id)
    balances = account_balances(db, user.id)
    return {"balance": from_cents(balances.get(account_id, 0))}
