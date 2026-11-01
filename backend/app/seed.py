from __future__ import annotations

from sqlalchemy.orm import Session

from .models import Category

DEFAULT_CATEGORIES: list[dict[str, str]] = [
    # expenses
    {"name": "Alimentari", "type": "expense", "color": "#F97316", "icon": "shopping-cart"},
    {"name": "Casa", "type": "expense", "color": "#0EA5E9", "icon": "home"},
    {"name": "Trasporti", "type": "expense", "color": "#8B5CF6", "icon": "car"},
    {"name": "Salute", "type": "expense", "color": "#EF4444", "icon": "heart-pulse"},
    {"name": "Svago", "type": "expense", "color": "#EC4899", "icon": "gamepad-2"},
    {"name": "Ristoranti", "type": "expense", "color": "#F59E0B", "icon": "utensils"},
    {"name": "Abbigliamento", "type": "expense", "color": "#14B8A6", "icon": "shirt"},
    {"name": "Abbonamenti", "type": "expense", "color": "#6366F1", "icon": "repeat"},
    {"name": "Istruzione", "type": "expense", "color": "#3B82F6", "icon": "graduation-cap"},
    {"name": "Viaggi", "type": "expense", "color": "#06B6D4", "icon": "plane"},
    {"name": "Altre spese", "type": "expense", "color": "#64748B", "icon": "more-horizontal"},
    # income
    {"name": "Stipendio", "type": "income", "color": "#10B981", "icon": "briefcase"},
    {"name": "Bonus", "type": "income", "color": "#22C55E", "icon": "gift"},
    {"name": "Investimenti", "type": "income", "color": "#84CC16", "icon": "trending-up"},
    {"name": "Rimborsi", "type": "income", "color": "#14B8A6", "icon": "undo-2"},
    {"name": "Altre entrate", "type": "income", "color": "#64748B", "icon": "plus-circle"},
]


def seed_default_categories(db: Session, user_id: int) -> None:
    existing = db.query(Category).filter(Category.user_id == user_id).count()
    if existing:
        return
    for item in DEFAULT_CATEGORIES:
        db.add(Category(user_id=user_id, is_default=True, **item))
    db.commit()
