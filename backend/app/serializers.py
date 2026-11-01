from __future__ import annotations

from .models import Account, Goal, RecurringTransaction, Transaction
from .schemas import (
    AccountOut,
    AccountRef,
    CategoryRef,
    ContributionOut,
    GoalOut,
    RecurringOut,
    TransactionOut,
)
from .services import from_cents, monthly_equivalent_cents


def account_out(account: Account, balance_cents: int = 0, transaction_count: int = 0) -> AccountOut:
    return AccountOut(
        id=account.id,
        name=account.name,
        type=account.type,
        initial_balance=from_cents(account.initial_balance_cents),
        balance=from_cents(balance_cents),
        currency=account.currency,
        color=account.color,
        icon=account.icon,
        notes=account.notes,
        archived=account.archived,
        sort_order=account.sort_order,
        transaction_count=transaction_count,
        created_at=account.created_at,
    )


def goal_out(goal: Goal) -> GoalOut:
    contributed = sum(item.amount_cents for item in goal.contributions)
    target = goal.target_amount_cents
    percentage = round(contributed / target * 100, 1) if target else 0
    return GoalOut(
        id=goal.id,
        name=goal.name,
        target_amount=from_cents(target),
        contributed=from_cents(contributed),
        remaining=from_cents(max(target - contributed, 0)),
        percentage=percentage,
        target_date=goal.target_date,
        color=goal.color,
        icon=goal.icon,
        notes=goal.notes,
        archived=goal.archived,
        is_reached=contributed >= target,
        contributions_count=len(goal.contributions),
        contributions=[
            ContributionOut(
                id=item.id,
                amount=from_cents(item.amount_cents),
                date=item.date,
                note=item.note,
            )
            for item in goal.contributions
        ],
    )


def recurring_out(rec: RecurringTransaction) -> RecurringOut:
    return RecurringOut(
        id=rec.id,
        type=rec.type,
        amount=from_cents(rec.amount_cents),
        description=rec.description,
        notes=rec.notes,
        frequency=rec.frequency,
        interval=rec.interval,
        start_date=rec.start_date,
        next_date=rec.next_date,
        end_date=rec.end_date,
        active=rec.active,
        auto_post=rec.auto_post,
        account_id=rec.account_id,
        account=rec.account,
        category_id=rec.category_id,
        category=rec.category,
        transfer_account_id=rec.transfer_account_id,
        transfer_account=rec.transfer_account,
        monthly_equivalent=from_cents(
            monthly_equivalent_cents(rec.amount_cents, rec.frequency, rec.interval)
        ),
        created_at=rec.created_at,
    )


def transaction_out(tx: Transaction) -> TransactionOut:
    return TransactionOut(
        id=tx.id,
        type=tx.type,
        amount=from_cents(tx.amount_cents),
        date=tx.date,
        description=tx.description,
        notes=tx.notes,
        account_id=tx.account_id,
        account=AccountRef.model_validate(tx.account),
        category_id=tx.category_id,
        category=CategoryRef.model_validate(tx.category) if tx.category else None,
        transfer_account_id=tx.transfer_account_id,
        transfer_account=AccountRef.model_validate(tx.transfer_account) if tx.transfer_account else None,
        recurring_id=tx.recurring_id,
        created_at=tx.created_at,
    )
