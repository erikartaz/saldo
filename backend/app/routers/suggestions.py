from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Transaction, User
from ..schemas import SuggestionItem, SuggestionsOut

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])


@router.get("/descriptions", response_model=SuggestionsOut)
def describe_suggestions(
    q: str | None = None,
    tx_type: str | None = Query(default=None, alias="type"),
    limit: int = Query(default=8, ge=1, le=30),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SuggestionsOut:
    query = (
        select(
            Transaction.description,
            func.count(Transaction.id),
            func.max(Transaction.date),
        )
        .where(Transaction.user_id == user.id)
        .group_by(Transaction.description)
        .order_by(func.max(Transaction.date).desc(), func.count(Transaction.id).desc())
        .limit(limit)
    )
    if q and q.strip():
        query = query.where(Transaction.description.ilike(f"%{q.strip()}%"))
    if tx_type in ("income", "expense", "transfer"):
        query = query.where(Transaction.type == tx_type)

    rows = db.execute(query).all()
    return SuggestionsOut(
        items=[
            SuggestionItem(value=description, count=int(count or 0), last_used=last_used)
            for description, count, last_used in rows
        ]
    )
