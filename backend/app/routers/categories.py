from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Budget, Category, RecurringTransaction, Transaction, User
from ..schemas import CategoryCreate, CategoryOut, CategoryUpdate
from ..services import current_month_key

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _category_or_404(db: Session, user_id: int, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    return category


def _serialize(db: Session, user_id: int, categories: list[Category]) -> list[CategoryOut]:
    tx_rows = db.execute(
        select(Transaction.category_id, func.count(Transaction.id))
        .where(Transaction.user_id == user_id)
        .group_by(Transaction.category_id)
    ).all()
    counts = {category_id: int(count) for category_id, count in tx_rows if category_id}
    budgeted = set(
        db.scalars(
            select(Budget.category_id).where(
                Budget.user_id == user_id, Budget.month == current_month_key()
            )
        ).all()
    )
    return [
        CategoryOut(
            id=category.id,
            name=category.name,
            type=category.type,
            color=category.color,
            icon=category.icon,
            is_default=category.is_default,
            archived=category.archived,
            transaction_count=counts.get(category.id, 0),
            budgeted=category.id in budgeted,
        )
        for category in categories
    ]


@router.get("", response_model=list[CategoryOut])
def list_categories(
    include_archived: bool = True,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CategoryOut]:
    query = select(Category).where(Category.user_id == user.id)
    if not include_archived:
        query = query.where(Category.archived.is_(False))
    categories = db.scalars(query.order_by(Category.type, Category.name)).all()
    return _serialize(db, user.id, categories)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CategoryOut:
    name = payload.name.strip()
    existing = db.scalar(
        select(Category).where(
            Category.user_id == user.id, Category.name == name, Category.type == payload.type
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Esiste già una categoria con questo nome")
    category = Category(
        user_id=user.id,
        name=name,
        type=payload.type,
        color=payload.color,
        icon=payload.icon,
        archived=payload.archived,
        is_default=False,
    )
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Categoria già esistente") from None
    db.refresh(category)
    return CategoryOut(
        id=category.id,
        name=category.name,
        type=category.type,
        color=category.color,
        icon=category.icon,
        is_default=category.is_default,
        archived=category.archived,
        transaction_count=0,
        budgeted=False,
    )


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CategoryOut:
    category = _category_or_404(db, user.id, category_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    if "type" in data and data["type"] is not None and data["type"] != category.type:
        used = db.scalar(
            select(func.count(Transaction.id)).where(Transaction.category_id == category.id)
        )
        if used:
            raise HTTPException(
                status_code=400,
                detail="Non puoi cambiare il tipo di una categoria già usata nei movimenti",
            )
    for field, value in data.items():
        setattr(category, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Esiste già una categoria con questo nome") from None
    db.refresh(category)
    return _serialize(db, user.id, [category])[0]


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    category = _category_or_404(db, user.id, category_id)
    tx_count = db.scalar(select(func.count(Transaction.id)).where(Transaction.category_id == category_id))
    budget_count = db.scalar(select(func.count(Budget.id)).where(Budget.category_id == category_id))
    recurring_count = db.scalar(
        select(func.count(RecurringTransaction.id)).where(RecurringTransaction.category_id == category_id)
    )
    if tx_count or budget_count or recurring_count:
        raise HTTPException(
            status_code=409,
            detail="La categoria è in uso. Archiviala per mantenerla nei dati storici.",
        )
    db.delete(category)
    db.commit()
