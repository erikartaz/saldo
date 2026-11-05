from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user
from ..models import Payee, RecurringTransaction, Transaction, User
from ..schemas import (
    ForecastOut,
    PostDueOut,
    RecurringCreate,
    RecurringOut,
    RecurringUpdate,
    TransactionOut,
)
from ..serializers import recurring_out, transaction_out
from ..services import (
    forecast,
    next_occurrence,
    post_due_recurring,
    to_cents,
    transaction_with_relations,
    validate_transaction_links,
)

router = APIRouter(prefix="/api/recurring", tags=["recurring"])


def _rec_or_404(db: Session, user_id: int, rec_id: int) -> RecurringTransaction:
    rec = db.scalars(
        select(RecurringTransaction)
        .options(
            joinedload(RecurringTransaction.account),
            joinedload(RecurringTransaction.category),
            joinedload(RecurringTransaction.payee).joinedload(Payee.default_category),
            joinedload(RecurringTransaction.transfer_account),
        )
        .where(RecurringTransaction.id == rec_id, RecurringTransaction.user_id == user_id)
    ).first()
    if rec is None:
        raise HTTPException(status_code=404, detail="Movimento ricorrente non trovato")
    return rec


@router.get("", response_model=list[RecurringOut])
def list_recurring(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RecurringOut]:
    items = db.scalars(
        select(RecurringTransaction)
        .options(
            joinedload(RecurringTransaction.account),
            joinedload(RecurringTransaction.category),
            joinedload(RecurringTransaction.payee).joinedload(Payee.default_category),
            joinedload(RecurringTransaction.transfer_account),
        )
        .where(RecurringTransaction.user_id == user.id)
        .order_by(RecurringTransaction.active.desc(), RecurringTransaction.next_date, RecurringTransaction.id)
    ).all()
    return [recurring_out(item) for item in items]


@router.post("", response_model=RecurringOut, status_code=status.HTTP_201_CREATED)
def create_recurring(
    payload: RecurringCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecurringOut:
    validate_transaction_links(
        db,
        user.id,
        account_id=payload.account_id,
        category_id=payload.category_id,
        payee_id=payload.payee_id,
        transfer_account_id=payload.transfer_account_id,
        tx_type=payload.type,
    )
    rec = RecurringTransaction(
        user_id=user.id,
        account_id=payload.account_id,
        category_id=payload.category_id,
        payee_id=payload.payee_id,
        transfer_account_id=payload.transfer_account_id,
        type=payload.type,
        amount_cents=to_cents(payload.amount),
        description=payload.description.strip(),
        notes=payload.notes,
        frequency=payload.frequency,
        interval=payload.interval,
        start_date=payload.start_date,
        next_date=payload.start_date,
        end_date=payload.end_date,
        active=payload.active,
        auto_post=payload.auto_post,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return recurring_out(_rec_or_404(db, user.id, rec.id))


@router.patch("/{rec_id}", response_model=RecurringOut)
def update_recurring(
    rec_id: int,
    payload: RecurringUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecurringOut:
    rec = _rec_or_404(db, user.id, rec_id)
    data = payload.model_dump(exclude_unset=True)

    effective_type = data.get("type", rec.type)
    effective_account = data.get("account_id", rec.account_id)
    effective_category = data.get("category_id", rec.category_id)
    effective_payee = data.get("payee_id", rec.payee_id)
    effective_transfer = data.get("transfer_account_id", rec.transfer_account_id)

    if effective_type == "transfer":
        effective_category = None
        effective_payee = None
        data["category_id"] = None
        data["payee_id"] = None
    else:
        effective_transfer = None
        data["transfer_account_id"] = None

    if "amount" in data and data["amount"] is not None:
        data["amount_cents"] = to_cents(data.pop("amount"))

    validate_transaction_links(
        db,
        user.id,
        account_id=effective_account,
        category_id=effective_category,
        payee_id=effective_payee,
        transfer_account_id=effective_transfer,
        tx_type=effective_type,
    )

    start_date = data.get("start_date", rec.start_date)
    end_date = data.get("end_date", rec.end_date)
    if end_date and end_date < start_date:
        raise HTTPException(status_code=400, detail="La data di fine deve essere successiva alla data di inizio")

    if "start_date" in data and data["start_date"] != rec.start_date:
        rec.next_date = data["start_date"]
    if "description" in data and data["description"] is not None:
        data["description"] = data["description"].strip()

    for field, value in data.items():
        setattr(rec, field, value)

    if end_date and rec.next_date > end_date:
        rec.active = False

    db.commit()
    db.refresh(rec)
    return recurring_out(_rec_or_404(db, user.id, rec.id))


@router.delete("/{rec_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring(
    rec_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    rec = _rec_or_404(db, user.id, rec_id)
    db.delete(rec)
    db.commit()


@router.post("/post-due", response_model=PostDueOut)
def post_due(
    auto_only: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostDueOut:
    created = post_due_recurring(db, user.id, auto_only=auto_only)
    items: list[TransactionOut] = []
    for tx in created:
        stored = transaction_with_relations(db, tx.id)
        if stored:
            items.append(transaction_out(stored))
    return PostDueOut(created=len(items), transactions=items)


@router.post("/{rec_id}/post", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def post_single(
    rec_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionOut:
    rec = _rec_or_404(db, user.id, rec_id)
    if not rec.active:
        raise HTTPException(status_code=400, detail="Il movimento ricorrente è sospeso")
    if rec.end_date and rec.next_date > rec.end_date:
        raise HTTPException(status_code=400, detail="La ricorrenza è terminata")

    today = date.today()
    tx_date = rec.next_date if rec.next_date <= today else today
    tx = Transaction(
        user_id=user.id,
        account_id=rec.account_id,
        category_id=rec.category_id,
        payee_id=rec.payee_id,
        transfer_account_id=rec.transfer_account_id,
        recurring_id=rec.id,
        type=rec.type,
        amount_cents=rec.amount_cents,
        date=tx_date,
        description=rec.description,
        notes=rec.notes,
    )
    db.add(tx)
    rec.next_date = next_occurrence(rec.next_date, rec.frequency, rec.interval)
    if rec.end_date and rec.next_date > rec.end_date:
        rec.active = False
    db.commit()
    db.refresh(tx)
    stored = transaction_with_relations(db, tx.id)
    assert stored is not None
    return transaction_out(stored)


@router.get("/forecast", response_model=ForecastOut)
def get_forecast(
    months: int = Query(default=3, ge=1, le=12),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForecastOut:
    months_data, upcoming, starting_balance = forecast(db, user.id, months)
    projected = starting_balance + sum(
        int(round(item.net * 100)) for item in months_data
    )
    return ForecastOut(
        starting_balance=round(starting_balance / 100, 2),
        months=months_data,
        projected_end_balance=round(projected / 100, 2),
        upcoming=upcoming,
    )
