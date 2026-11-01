from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Budget, User
from ..schemas import BudgetCopy, BudgetSummary, BudgetUpsert
from ..services import (
    budget_summary,
    current_month_key,
    month_bounds,
    owned_category,
    to_cents,
)

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


@router.get("", response_model=BudgetSummary)
def get_budgets(
    month: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetSummary:
    month = month or current_month_key()
    try:
        month_bounds(month)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Mese non valido, usa il formato YYYY-MM") from None
    return budget_summary(db, user.id, month)


@router.post("", response_model=BudgetSummary, status_code=status.HTTP_201_CREATED)
def upsert_budget(
    payload: BudgetUpsert,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetSummary:
    category = owned_category(db, user.id, payload.category_id)
    if category.type != "expense":
        raise HTTPException(status_code=400, detail="Puoi creare budget solo per categorie di spesa")
    if category.archived:
        raise HTTPException(status_code=400, detail="La categoria è archiviata")

    budget = db.scalar(
        select(Budget).where(
            Budget.user_id == user.id,
            Budget.category_id == payload.category_id,
            Budget.month == payload.month,
        )
    )
    if budget:
        budget.amount_cents = to_cents(payload.amount)
    else:
        budget = Budget(
            user_id=user.id,
            category_id=payload.category_id,
            month=payload.month,
            amount_cents=to_cents(payload.amount),
        )
        db.add(budget)
    db.commit()
    return budget_summary(db, user.id, payload.month)


@router.patch("/{budget_id}", response_model=BudgetSummary)
def update_budget(
    budget_id: int,
    payload: BudgetUpsert,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetSummary:
    budget = db.get(Budget, budget_id)
    if budget is None or budget.user_id != user.id:
        raise HTTPException(status_code=404, detail="Budget non trovato")
    budget.amount_cents = to_cents(payload.amount)
    db.commit()
    return budget_summary(db, user.id, budget.month)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    budget = db.get(Budget, budget_id)
    if budget is None or budget.user_id != user.id:
        raise HTTPException(status_code=404, detail="Budget non trovato")
    db.delete(budget)
    db.commit()


@router.post("/copy", response_model=BudgetSummary, status_code=status.HTTP_201_CREATED)
def copy_budgets(
    payload: BudgetCopy,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetSummary:
    if payload.from_month == payload.to_month:
        raise HTTPException(status_code=400, detail="Scegli due mesi diversi")
    source = db.scalars(
        select(Budget).where(Budget.user_id == user.id, Budget.month == payload.from_month)
    ).all()
    if not source:
        raise HTTPException(status_code=404, detail="Nessun budget nel mese di origine")

    for item in source:
        existing = db.scalar(
            select(Budget).where(
                Budget.user_id == user.id,
                Budget.category_id == item.category_id,
                Budget.month == payload.to_month,
            )
        )
        if existing:
            existing.amount_cents = item.amount_cents
        else:
            db.add(
                Budget(
                    user_id=user.id,
                    category_id=item.category_id,
                    month=payload.to_month,
                    amount_cents=item.amount_cents,
                )
            )
    db.commit()
    return budget_summary(db, user.id, payload.to_month)
