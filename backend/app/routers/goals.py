from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Goal, GoalContribution, User
from ..schemas import ContributionCreate, GoalCreate, GoalOut, GoalUpdate
from ..serializers import goal_out
from ..services import from_cents, goals_with_totals, to_cents

router = APIRouter(prefix="/api/goals", tags=["goals"])


def _goal_or_404(db: Session, user_id: int, goal_id: int) -> Goal:
    goal = db.scalars(
        select(Goal)
        .options(selectinload(Goal.contributions))
        .where(Goal.id == goal_id)
        .execution_options(populate_existing=True)
    ).first()
    if goal is None or goal.user_id != user_id:
        raise HTTPException(status_code=404, detail="Obiettivo non trovato")
    return goal


@router.get("", response_model=list[GoalOut])
def list_goals(
    include_archived: bool = True,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GoalOut]:
    goals = goals_with_totals(db, user.id)
    if not include_archived:
        goals = [goal for goal in goals if not goal.archived]
    return [goal_out(goal) for goal in goals]


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = Goal(
        user_id=user.id,
        name=payload.name.strip(),
        target_amount_cents=to_cents(payload.target_amount),
        target_date=payload.target_date,
        color=payload.color,
        icon=payload.icon,
        notes=payload.notes,
        archived=payload.archived,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal_out(_goal_or_404(db, user.id, goal.id))


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = _goal_or_404(db, user.id, goal_id)
    data = payload.model_dump(exclude_unset=True)
    if "target_amount" in data and data["target_amount"] is not None:
        data["target_amount_cents"] = to_cents(data.pop("target_amount"))
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    for field, value in data.items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal_out(_goal_or_404(db, user.id, goal.id))


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    goal = _goal_or_404(db, user.id, goal_id)
    db.delete(goal)
    db.commit()


@router.post("/{goal_id}/contributions", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def add_contribution(
    goal_id: int,
    payload: ContributionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = _goal_or_404(db, user.id, goal_id)
    db.add(
        GoalContribution(
            goal_id=goal.id,
            amount_cents=to_cents(payload.amount),
            date=payload.date,
            note=payload.note,
        )
    )
    db.commit()
    return goal_out(_goal_or_404(db, user.id, goal.id))


@router.delete("/{goal_id}/contributions/{contribution_id}", response_model=GoalOut)
def delete_contribution(
    goal_id: int,
    contribution_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = _goal_or_404(db, user.id, goal_id)
    contribution = db.get(GoalContribution, contribution_id)
    if contribution is None or contribution.goal_id != goal.id:
        raise HTTPException(status_code=404, detail="Versamento non trovato")
    db.delete(contribution)
    db.commit()
    return goal_out(_goal_or_404(db, user.id, goal.id))


@router.get("/{goal_id}/contributions")
def list_contributions(
    goal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    goal = _goal_or_404(db, user.id, goal_id)
    return [
        {
            "id": item.id,
            "amount": from_cents(item.amount_cents),
            "date": item.date,
            "note": item.note,
        }
        for item in goal.contributions
    ]
