from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user
from ..models import Payee, Transaction, User
from ..schemas import (
    TransactionCreate,
    TransactionOut,
    TransactionPage,
    TransactionTotals,
)
from ..serializers import transaction_out
from ..services import (
    from_cents,
    owned_payee,
    to_cents,
    transaction_with_relations,
    validate_transaction_links,
)

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _filters(
    user_id: int,
    q: str | None,
    tx_type: str | None,
    account_id: int | None,
    category_id: int | None,
    payee_id: int | None,
    date_from: date | None,
    date_to: date | None,
):
    conditions = [Transaction.user_id == user_id]
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(
            or_(
                Transaction.description.ilike(pattern),
                Transaction.notes.ilike(pattern),
                Transaction.payee.has(Payee.name.ilike(pattern)),
            )
        )
    if tx_type:
        conditions.append(Transaction.type == tx_type)
    if account_id:
        conditions.append(
            or_(
                Transaction.account_id == account_id,
                Transaction.transfer_account_id == account_id,
            )
        )
    if category_id:
        conditions.append(Transaction.category_id == category_id)
    if payee_id:
        conditions.append(Transaction.payee_id == payee_id)
    if date_from:
        conditions.append(Transaction.date >= date_from)
    if date_to:
        conditions.append(Transaction.date <= date_to)
    return conditions


def _default_category_for_payee(
    db: Session, user_id: int, payload: TransactionCreate
) -> int | None:
    if payload.category_id is not None or payload.payee_id is None:
        return payload.category_id
    payee = owned_payee(db, user_id, payload.payee_id)
    expected = "income" if payload.type == "income" else "expense"
    if payee.default_category and payee.default_category.type == expected:
        return payee.default_category_id
    return None


@router.get("", response_model=TransactionPage)
def list_transactions(
    q: str | None = None,
    tx_type: str | None = Query(default=None, alias="type"),
    account_id: int | None = None,
    category_id: int | None = None,
    payee_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionPage:
    conditions = _filters(user.id, q, tx_type, account_id, category_id, payee_id, date_from, date_to)

    total = db.scalar(select(func.count(Transaction.id)).where(*conditions)) or 0
    totals_rows = db.execute(
        select(Transaction.type, func.sum(Transaction.amount_cents))
        .where(*conditions)
        .group_by(Transaction.type)
    ).all()
    totals = {"income": 0, "expense": 0}
    for row_type, amount in totals_rows:
        if row_type in totals:
            totals[row_type] = int(amount or 0)

    items = db.scalars(
        select(Transaction)
        .options(
            joinedload(Transaction.account),
            joinedload(Transaction.category),
            joinedload(Transaction.payee).joinedload(Payee.default_category),
            joinedload(Transaction.transfer_account),
        )
        .where(*conditions)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    income = from_cents(totals["income"])
    expense = from_cents(totals["expense"])
    return TransactionPage(
        items=[transaction_out(tx) for tx in items],
        total=total,
        page=page,
        page_size=page_size,
        totals=TransactionTotals(
            income=income,
            expense=expense,
            net=round(income - expense, 2),
            count=total,
        ),
    )


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(
    transaction_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionOut:
    tx = transaction_with_relations(db, transaction_id)
    if tx is None or tx.user_id != user.id:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    return transaction_out(tx)


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionOut:
    validate_transaction_links(
        db,
        user.id,
        account_id=payload.account_id,
        category_id=payload.category_id,
        payee_id=payload.payee_id,
        transfer_account_id=payload.transfer_account_id,
        tx_type=payload.type,
    )
    category_id = _default_category_for_payee(db, user.id, payload)
    tx = Transaction(
        user_id=user.id,
        account_id=payload.account_id,
        category_id=category_id,
        payee_id=payload.payee_id,
        transfer_account_id=payload.transfer_account_id,
        type=payload.type,
        amount_cents=to_cents(payload.amount),
        date=payload.date,
        description=payload.description.strip(),
        notes=payload.notes,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    stored = transaction_with_relations(db, tx.id)
    assert stored is not None
    return transaction_out(stored)


@router.put("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: int,
    payload: TransactionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionOut:
    tx = transaction_with_relations(db, transaction_id)
    if tx is None or tx.user_id != user.id:
        raise HTTPException(status_code=404, detail="Movimento non trovato")

    validate_transaction_links(
        db,
        user.id,
        account_id=payload.account_id,
        category_id=payload.category_id,
        payee_id=payload.payee_id,
        transfer_account_id=payload.transfer_account_id,
        tx_type=payload.type,
    )
    tx.account_id = payload.account_id
    tx.category_id = _default_category_for_payee(db, user.id, payload)
    tx.payee_id = payload.payee_id
    tx.transfer_account_id = payload.transfer_account_id
    tx.type = payload.type
    tx.amount_cents = to_cents(payload.amount)
    tx.date = payload.date
    tx.description = payload.description.strip()
    tx.notes = payload.notes
    db.commit()
    stored = transaction_with_relations(db, tx.id)
    assert stored is not None
    return transaction_out(stored)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    tx = db.get(Transaction, transaction_id)
    if tx is None or tx.user_id != user.id:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    db.delete(tx)
    db.commit()
