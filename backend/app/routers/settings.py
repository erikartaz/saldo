from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Account, Budget, Category, Goal, GoalContribution, Payee, RecurringTransaction, Transaction, User
from ..schemas import SettingsOut
from ..security import verify_password
from ..seed import seed_default_categories

router = APIRouter(prefix="/api/settings", tags=["settings"])

VERSION = "1.0.0"


class ResetIn(BaseModel):
    password: str
    confirm: str


def _database_size_kb() -> float:
    try:
        raw = settings.database_url.replace("sqlite:///", "")
        path = Path(raw)
        total = 0
        for suffix in ("", "-wal", "-shm"):
            candidate = Path(str(path) + suffix)
            if candidate.exists():
                total += candidate.stat().st_size
        return round(total / 1024, 1)
    except OSError:
        return 0.0


@router.get("", response_model=SettingsOut)
def get_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SettingsOut:
    return SettingsOut(
        currency=user.currency,
        categories_count=db.scalar(select(func.count(Category.id)).where(Category.user_id == user.id)) or 0,
        transactions_count=db.scalar(select(func.count(Transaction.id)).where(Transaction.user_id == user.id)) or 0,
        accounts_count=db.scalar(select(func.count(Account.id)).where(Account.user_id == user.id)) or 0,
        database_size_kb=_database_size_kb(),
        version=VERSION,
    )


@router.post("/reset", status_code=status.HTTP_200_OK)
def reset_data(
    payload: ResetIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, int | str]:
    if payload.confirm.strip().upper() != "ELIMINA":
        raise HTTPException(status_code=400, detail='Scrivi "ELIMINA" per confermare')
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Password non corretta")

    goal_ids = select(Goal.id).where(Goal.user_id == user.id)
    deleted = {
        "transactions": db.query(Transaction).filter(Transaction.user_id == user.id).delete(synchronize_session=False),
        "budgets": db.query(Budget).filter(Budget.user_id == user.id).delete(synchronize_session=False),
        "recurring": db.query(RecurringTransaction)
        .filter(RecurringTransaction.user_id == user.id)
        .delete(synchronize_session=False),
        "contributions": db.query(GoalContribution)
        .filter(GoalContribution.goal_id.in_(goal_ids))
        .delete(synchronize_session=False),
        "goals": db.query(Goal).filter(Goal.user_id == user.id).delete(synchronize_session=False),
        "accounts": db.query(Account).filter(Account.user_id == user.id).delete(synchronize_session=False),
        "payees": db.query(Payee).filter(Payee.user_id == user.id).delete(synchronize_session=False),
        "categories": db.query(Category).filter(Category.user_id == user.id).delete(synchronize_session=False),
    }
    db.commit()
    seed_default_categories(db, user.id)
    return {"status": "ok", **deleted}
