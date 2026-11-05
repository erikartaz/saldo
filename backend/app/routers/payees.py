from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user
from ..models import Payee, Transaction, User
from ..schemas import CategoryRef, PayeeCreate, PayeeOut, PayeeUpdate
from ..services import from_cents, owned_category

router = APIRouter(prefix="/api/payees", tags=["payees"])


def normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _payee_or_404(db: Session, user_id: int, payee_id: int) -> Payee:
    payee = db.scalars(
        select(Payee)
        .options(joinedload(Payee.default_category))
        .where(Payee.id == payee_id, Payee.user_id == user_id)
    ).first()
    if payee is None:
        raise HTTPException(status_code=404, detail="Beneficiario non trovato")
    return payee


def _stats(
    db: Session, user_id: int, payee_ids: list[int]
) -> dict[int, dict[str, int | date | None]]:
    if not payee_ids:
        return {}
    rows = db.execute(
        select(
            Transaction.payee_id,
            Transaction.type,
            func.sum(Transaction.amount_cents),
            func.count(Transaction.id),
            func.max(Transaction.date),
        )
        .where(Transaction.user_id == user_id, Transaction.payee_id.in_(payee_ids))
        .group_by(Transaction.payee_id, Transaction.type)
    ).all()

    stats: dict[int, dict[str, int | date | None]] = {
        payee_id: {
            "count": 0,
            "expense": 0,
            "income": 0,
            "last_used": None,
        }
        for payee_id in payee_ids
    }
    for payee_id, tx_type, total, count, last_used in rows:
        item = stats[payee_id]
        item["count"] = int(item["count"] or 0) + int(count or 0)
        if tx_type == "expense":
            item["expense"] = int(item["expense"] or 0) + int(total or 0)
        elif tx_type == "income":
            item["income"] = int(item["income"] or 0) + int(total or 0)
        if last_used and (item["last_used"] is None or last_used > item["last_used"]):
            item["last_used"] = last_used
    return stats


def _payee_out(payee: Payee, stats: dict[str, int | date | None]) -> PayeeOut:
    return PayeeOut(
        id=payee.id,
        name=payee.name,
        default_category_id=payee.default_category_id,
        default_category=CategoryRef.model_validate(payee.default_category)
        if payee.default_category
        else None,
        notes=payee.notes,
        archived=payee.archived,
        transaction_count=int(stats["count"] or 0),
        expense_total=from_cents(int(stats["expense"] or 0)),
        income_total=from_cents(int(stats["income"] or 0)),
        last_used=stats["last_used"] if isinstance(stats["last_used"], date) else None,
        created_at=payee.created_at,
    )


def _list_payees(
    db: Session,
    user_id: int,
    *,
    q: str | None = None,
    include_archived: bool = True,
    limit: int = 500,
    sort: str = "name",
) -> list[PayeeOut]:
    query = select(Payee).options(joinedload(Payee.default_category)).where(Payee.user_id == user_id)
    if q and q.strip():
        query = query.where(Payee.name.ilike(f"%{q.strip()}%"))
    if not include_archived:
        query = query.where(Payee.archived.is_(False))
    payees = db.scalars(query.order_by(Payee.name)).all()
    stats = _stats(db, user_id, [payee.id for payee in payees])
    items = [_payee_out(payee, stats[payee.id]) for payee in payees]

    if sort == "recent":
        items.sort(key=lambda item: (item.last_used is not None, item.last_used or date.min), reverse=True)
    else:
        items.sort(key=lambda item: (item.archived, item.name.lower()))
    return items[:limit]


@router.get("/suggestions", response_model=list[PayeeOut])
def suggest_payees(
    q: str | None = None,
    limit: int = Query(default=8, ge=1, le=30),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PayeeOut]:
    items = _list_payees(db, user.id, q=q, include_archived=False, limit=max(limit * 4, 30), sort="recent")
    return items[:limit]


@router.get("", response_model=list[PayeeOut])
def list_payees(
    q: str | None = None,
    include_archived: bool = True,
    limit: int = Query(default=500, ge=1, le=1000),
    sort: str = Query(default="name", pattern="^(name|recent)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PayeeOut]:
    return _list_payees(
        db,
        user.id,
        q=q,
        include_archived=include_archived,
        limit=limit,
        sort=sort,
    )


@router.post("", response_model=PayeeOut, status_code=status.HTTP_201_CREATED)
def create_payee(
    payload: PayeeCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayeeOut:
    name = payload.name.strip()
    normalized = normalize_name(name)
    if not normalized:
        raise HTTPException(status_code=400, detail="Nome beneficiario non valido")
    if db.scalar(select(Payee).where(Payee.user_id == user.id, Payee.normalized_name == normalized)):
        raise HTTPException(status_code=409, detail="Esiste già un beneficiario con questo nome")
    if payload.default_category_id is not None:
        owned_category(db, user.id, payload.default_category_id)

    payee = Payee(
        user_id=user.id,
        name=name,
        normalized_name=normalized,
        default_category_id=payload.default_category_id,
        notes=payload.notes,
        archived=payload.archived,
    )
    db.add(payee)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Esiste già un beneficiario con questo nome") from None
    db.refresh(payee)
    return _payee_out(payee, {"count": 0, "expense": 0, "income": 0, "last_used": None})


@router.patch("/{payee_id}", response_model=PayeeOut)
def update_payee(
    payee_id: int,
    payload: PayeeUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayeeOut:
    payee = _payee_or_404(db, user.id, payee_id)
    data = payload.model_dump(exclude_unset=True)

    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        normalized = normalize_name(name)
        if not normalized:
            raise HTTPException(status_code=400, detail="Nome beneficiario non valido")
        duplicate = db.scalar(
            select(Payee).where(
                Payee.user_id == user.id,
                Payee.normalized_name == normalized,
                Payee.id != payee.id,
            )
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Esiste già un beneficiario con questo nome")
        data["name"] = name
        data["normalized_name"] = normalized
    if data.get("default_category_id") is not None:
        owned_category(db, user.id, data["default_category_id"])

    for field, value in data.items():
        setattr(payee, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Esiste già un beneficiario con questo nome") from None
    db.refresh(payee)
    stats = _stats(db, user.id, [payee.id])
    return _payee_out(payee, stats[payee.id])


@router.get("/{payee_id}", response_model=PayeeOut)
def get_payee(
    payee_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayeeOut:
    payee = _payee_or_404(db, user.id, payee_id)
    stats = _stats(db, user.id, [payee.id])
    return _payee_out(payee, stats[payee.id])


@router.delete("/{payee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payee(
    payee_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    payee = _payee_or_404(db, user.id, payee_id)
    used = db.scalar(select(func.count(Transaction.id)).where(Transaction.payee_id == payee.id))
    if used:
        raise HTTPException(
            status_code=409,
            detail="Il beneficiario è usato nei movimenti. Archivialo invece di eliminarlo.",
        )
    db.delete(payee)
    db.commit()
