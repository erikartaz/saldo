from __future__ import annotations

import calendar
from datetime import date, timedelta
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from .models import (
    Account,
    Budget,
    Category,
    Goal,
    Payee,
    RecurringTransaction,
    Transaction,
)
from .schemas import (
    BudgetOut,
    BudgetSummary,
    CategoryRef,
    CategorySlice,
    ForecastMonth,
    ForecastOccurrence,
    MonthPoint,
    NetWorthPoint,
)

MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]


# ------------------------------------------------------------------- money utils
def to_cents(value: float) -> int:
    return int(round(value * 100))


def from_cents(value: int | float | None) -> float:
    return round((value or 0) / 100, 2)


# ------------------------------------------------------------------- date helpers
def current_month_key() -> str:
    today = date.today()
    return f"{today.year:04d}-{today.month:02d}"


def parse_month_key(value: str) -> tuple[int, int]:
    year, month = value.split("-")
    return int(year), int(month)


def month_bounds(value: str) -> tuple[date, date]:
    year, month = parse_month_key(value)
    start = date(year, month, 1)
    return start, add_months(start, 1)


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def shift_month(value: str, delta: int) -> str:
    year, month = parse_month_key(value)
    start = add_months(date(year, month, 1), delta)
    return f"{start.year:04d}-{start.month:02d}"


def month_label(value: str) -> str:
    year, month = parse_month_key(value)
    return f"{MONTH_LABELS[month - 1]} {year}"


def previous_month(value: str) -> str:
    return shift_month(value, -1)


def next_occurrence(value: date, frequency: str, interval: int) -> date:
    if frequency == "daily":
        return value + timedelta(days=interval)
    if frequency == "weekly":
        return value + timedelta(weeks=interval)
    if frequency == "monthly":
        return add_months(value, interval)
    if frequency == "yearly":
        return add_months(value, 12 * interval)
    return add_months(value, interval)


def monthly_equivalent_cents(amount_cents: int, frequency: str, interval: int) -> int:
    interval = max(interval, 1)
    if frequency == "daily":
        return round(amount_cents * 365 / 12 / interval)
    if frequency == "weekly":
        return round(amount_cents * 52 / 12 / interval)
    if frequency == "yearly":
        return round(amount_cents / 12 / interval)
    return round(amount_cents / interval)


# ---------------------------------------------------------------- account balances
def account_balances(db: Session, user_id: int) -> dict[int, int]:
    accounts = db.scalars(select(Account).where(Account.user_id == user_id)).all()
    balances = {account.id: account.initial_balance_cents for account in accounts}

    rows = db.execute(
        select(Transaction.account_id, Transaction.type, func.sum(Transaction.amount_cents))
        .where(Transaction.user_id == user_id)
        .group_by(Transaction.account_id, Transaction.type)
    ).all()
    for account_id, tx_type, total in rows:
        if account_id not in balances:
            continue
        if tx_type == "income":
            balances[account_id] += int(total or 0)
        elif tx_type == "expense":
            balances[account_id] -= int(total or 0)
        elif tx_type == "transfer":
            balances[account_id] -= int(total or 0)

    incoming = db.execute(
        select(Transaction.transfer_account_id, func.sum(Transaction.amount_cents))
        .where(Transaction.user_id == user_id, Transaction.type == "transfer")
        .group_by(Transaction.transfer_account_id)
    ).all()
    for account_id, total in incoming:
        if account_id in balances:
            balances[account_id] += int(total or 0)

    return balances


def account_transaction_counts(db: Session, user_id: int) -> dict[int, int]:
    rows = db.execute(
        select(Transaction.account_id, func.count(Transaction.id))
        .where(Transaction.user_id == user_id)
        .group_by(Transaction.account_id)
    ).all()
    counts = {account_id: int(count) for account_id, count in rows}
    incoming = db.execute(
        select(Transaction.transfer_account_id, func.count(Transaction.id))
        .where(Transaction.user_id == user_id, Transaction.type == "transfer")
        .group_by(Transaction.transfer_account_id)
    ).all()
    for account_id, count in incoming:
        if account_id is not None:
            counts[account_id] = counts.get(account_id, 0) + int(count)
    return counts


def total_balance(db: Session, user_id: int, include_archived: bool = False) -> int:
    balances = account_balances(db, user_id)
    query = select(Account).where(Account.user_id == user_id)
    if not include_archived:
        query = query.where(Account.archived.is_(False))
    accounts = db.scalars(query).all()
    return sum(balances.get(account.id, 0) for account in accounts)


# ------------------------------------------------------------------- aggregations
def _month_keys(start: str, end: str) -> list[str]:
    keys: list[str] = []
    cursor = start
    while cursor <= end:
        keys.append(cursor)
        cursor = shift_month(cursor, 1)
    return keys


def monthly_series(db: Session, user_id: int, months: int = 6, end_month: str | None = None) -> list[MonthPoint]:
    end_month = end_month or current_month_key()
    start_month = shift_month(end_month, -(months - 1))
    start, _ = month_bounds(start_month)
    _, end = month_bounds(end_month)

    rows = db.execute(
        select(Transaction.date, Transaction.type, Transaction.amount_cents).where(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date < end,
            Transaction.type != "transfer",
        )
    ).all()

    buckets: dict[str, dict[str, int]] = {
        key: {"income": 0, "expense": 0} for key in _month_keys(start_month, end_month)
    }
    for tx_date, tx_type, amount in rows:
        key = f"{tx_date.year:04d}-{tx_date.month:02d}"
        if key in buckets and tx_type in ("income", "expense"):
            buckets[key][tx_type] += int(amount or 0)

    series: list[MonthPoint] = []
    for key in _month_keys(start_month, end_month):
        income = buckets[key]["income"]
        expense = buckets[key]["expense"]
        series.append(
            MonthPoint(
                month=key,
                label=month_label(key),
                income=from_cents(income),
                expense=from_cents(expense),
                net=from_cents(income - expense),
            )
        )
    return series


def net_worth_series(db: Session, user_id: int, months: int = 12, end_month: str | None = None) -> list[NetWorthPoint]:
    end_month = end_month or current_month_key()
    start_month = shift_month(end_month, -(months - 1))
    start, _ = month_bounds(start_month)
    _, end = month_bounds(end_month)

    accounts = db.scalars(
        select(Account).where(Account.user_id == user_id, Account.archived.is_(False))
    ).all()
    active_ids = {account.id for account in accounts}
    running = sum(account.initial_balance_cents for account in accounts)

    def delta(tx_type: str, amount: int, account_id: int, transfer_account_id: int | None) -> int:
        if tx_type == "transfer":
            value = 0
            if account_id in active_ids:
                value -= amount
            if transfer_account_id in active_ids:
                value += amount
            return value
        if account_id not in active_ids:
            return 0
        return amount if tx_type == "income" else -amount

    rows = db.execute(
        select(
            Transaction.date,
            Transaction.type,
            Transaction.amount_cents,
            Transaction.account_id,
            Transaction.transfer_account_id,
        ).where(Transaction.user_id == user_id, Transaction.date < start)
    ).all()
    for _tx_date, tx_type, amount, account_id, transfer_account_id in rows:
        running += delta(tx_type, int(amount or 0), account_id, transfer_account_id)

    rows = db.execute(
        select(
            Transaction.date,
            Transaction.type,
            Transaction.amount_cents,
            Transaction.account_id,
            Transaction.transfer_account_id,
        ).where(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date < end,
        )
    ).all()
    per_month: dict[str, int] = {key: 0 for key in _month_keys(start_month, end_month)}
    for tx_date, tx_type, amount, account_id, transfer_account_id in rows:
        key = f"{tx_date.year:04d}-{tx_date.month:02d}"
        if key in per_month:
            per_month[key] += delta(tx_type, int(amount or 0), account_id, transfer_account_id)

    points: list[NetWorthPoint] = []
    for key in _month_keys(start_month, end_month):
        running += per_month[key]
        points.append(NetWorthPoint(month=key, label=month_label(key), value=from_cents(running)))
    return points


def category_breakdown(
    db: Session, user_id: int, start: date, end: date, tx_type: str = "expense"
) -> list[CategorySlice]:
    rows = db.execute(
        select(
            Transaction.category_id,
            func.sum(Transaction.amount_cents),
            func.count(Transaction.id),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.type == tx_type,
            Transaction.date >= start,
            Transaction.date < end,
        )
        .group_by(Transaction.category_id)
    ).all()

    categories = {
        category.id: category
        for category in db.scalars(select(Category).where(Category.user_id == user_id)).all()
    }
    total = sum(int(amount or 0) for _, amount, _ in rows)
    slices: list[CategorySlice] = []
    for category_id, amount, count in rows:
        amount = int(amount or 0)
        category = categories.get(category_id) if category_id else None
        slices.append(
            CategorySlice(
                category_id=category_id,
                name=category.name if category else "Senza categoria",
                color=category.color if category else "#94A3B8",
                icon=category.icon if category else "circle-help",
                amount=from_cents(amount),
                percentage=round(amount / total * 100, 1) if total else 0,
                count=int(count),
            )
        )
    slices.sort(key=lambda item: item.amount, reverse=True)
    return slices


def range_totals(db: Session, user_id: int, start: date, end: date) -> tuple[int, int]:
    rows = db.execute(
        select(Transaction.type, func.sum(Transaction.amount_cents))
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date < end,
            Transaction.type != "transfer",
        )
        .group_by(Transaction.type)
    ).all()
    totals = {"income": 0, "expense": 0}
    for tx_type, amount in rows:
        totals[tx_type] = int(amount or 0)
    return totals["income"], totals["expense"]


# ----------------------------------------------------------------------- budgets
def budget_summary(db: Session, user_id: int, month: str) -> BudgetSummary:
    start, end = month_bounds(month)
    budgets = db.scalars(
        select(Budget)
        .options(joinedload(Budget.category))
        .where(Budget.user_id == user_id, Budget.month == month)
        .order_by(Budget.id)
    ).all()

    spent_rows = db.execute(
        select(Transaction.category_id, func.sum(Transaction.amount_cents))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date < end,
        )
        .group_by(Transaction.category_id)
    ).all()
    spent_by_category = {category_id: int(amount or 0) for category_id, amount in spent_rows}

    items: list[BudgetOut] = []
    budgeted_ids: set[int] = set()
    for budget in budgets:
        if budget.category is None:
            continue
        budgeted_ids.add(budget.category_id)
        spent = spent_by_category.get(budget.category_id, 0)
        percentage = round(spent / budget.amount_cents * 100, 1) if budget.amount_cents else 0
        items.append(
            BudgetOut(
                id=budget.id,
                month=budget.month,
                amount=from_cents(budget.amount_cents),
                spent=from_cents(spent),
                remaining=from_cents(budget.amount_cents - spent),
                percentage=percentage,
                over_budget=spent > budget.amount_cents,
                category=CategoryRef.model_validate(budget.category),
            )
        )
    items.sort(key=lambda item: item.percentage, reverse=True)

    total_budget = sum(budget.amount_cents for budget in budgets)
    total_spent = sum(spent_by_category.get(category_id, 0) for category_id in budgeted_ids)
    unbudgeted = sum(amount for category_id, amount in spent_by_category.items() if category_id not in budgeted_ids)

    return BudgetSummary(
        month=month,
        items=items,
        total_budget=from_cents(total_budget),
        total_spent=from_cents(total_spent),
        total_remaining=from_cents(total_budget - total_spent),
        unbudgeted_spent=from_cents(unbudgeted),
        categories_count=len(items),
        over_budget_count=sum(1 for item in items if item.over_budget),
    )


# --------------------------------------------------------------------- recurring
def occurrences_between(rec: RecurringTransaction, start: date, end: date) -> list[date]:
    occurrences: list[date] = []
    cursor = rec.next_date
    guard = 0
    while cursor < start and guard < 6000:
        cursor = next_occurrence(cursor, rec.frequency, rec.interval)
        guard += 1
    while cursor <= end and guard < 6000:
        if rec.end_date and cursor > rec.end_date:
            break
        occurrences.append(cursor)
        cursor = next_occurrence(cursor, rec.frequency, rec.interval)
        guard += 1
    return occurrences


def _occurrence_recurring_query():
    return (
        select(RecurringTransaction)
        .options(
            joinedload(RecurringTransaction.account),
            joinedload(RecurringTransaction.category),
            joinedload(RecurringTransaction.payee),
            joinedload(RecurringTransaction.transfer_account),
        )
        .where(RecurringTransaction.active.is_(True))
    )


def forecast(db: Session, user_id: int, months: int = 3) -> tuple[list[ForecastMonth], list[ForecastOccurrence], int]:
    today = date.today()
    current = current_month_key()
    recurring = db.scalars(_occurrence_recurring_query().where(RecurringTransaction.user_id == user_id)).all()

    forecast_months: list[ForecastMonth] = []
    for offset in range(months):
        key = shift_month(current, offset)
        start, end = month_bounds(key)
        end_inclusive = end - timedelta(days=1)
        occurrences: list[ForecastOccurrence] = []
        income = 0
        expense = 0
        for rec in recurring:
            for occurrence in occurrences_between(rec, start, end_inclusive):
                if occurrence < today and offset > 0:
                    continue
                item = ForecastOccurrence(
                    recurring_id=rec.id,
                    date=occurrence,
                    description=rec.description,
                    type=rec.type,
                    amount=from_cents(rec.amount_cents),
                    account_id=rec.account_id,
                    account_name=rec.account.name if rec.account else "",
                    category_name=rec.category.name if rec.category else None,
                    category_color=rec.category.color if rec.category else None,
                )
                occurrences.append(item)
                if rec.type == "income":
                    income += rec.amount_cents
                elif rec.type == "expense":
                    expense += rec.amount_cents
        occurrences.sort(key=lambda item: (item.date, item.description))
        forecast_months.append(
            ForecastMonth(
                month=key,
                label=month_label(key),
                income=from_cents(income),
                expense=from_cents(expense),
                net=from_cents(income - expense),
                occurrences=occurrences,
            )
        )

    upcoming: list[ForecastOccurrence] = []
    horizon = today + timedelta(days=30)
    for rec in recurring:
        for occurrence in occurrences_between(rec, min(today, rec.next_date), horizon):
            upcoming.append(
                ForecastOccurrence(
                    recurring_id=rec.id,
                    date=occurrence,
                    description=rec.description,
                    type=rec.type,
                    amount=from_cents(rec.amount_cents),
                    account_id=rec.account_id,
                    account_name=rec.account.name if rec.account else "",
                    category_name=rec.category.name if rec.category else None,
                    category_color=rec.category.color if rec.category else None,
                )
            )
    upcoming.sort(key=lambda item: (item.date, item.description))
    return forecast_months, upcoming, total_balance(db, user_id)


def post_due_recurring(
    db: Session, user_id: int, auto_only: bool = False, today: date | None = None
) -> list[Transaction]:
    today = today or date.today()
    query = _occurrence_recurring_query().where(
        RecurringTransaction.user_id == user_id,
        RecurringTransaction.next_date <= today,
    )
    if auto_only:
        query = query.where(RecurringTransaction.auto_post.is_(True))

    recurring = db.scalars(query).all()
    created: list[Transaction] = []
    for rec in recurring:
        guard = 0
        while rec.next_date <= today and guard < 120:
            if rec.end_date and rec.next_date > rec.end_date:
                rec.active = False
                break
            tx = Transaction(
                user_id=user_id,
                account_id=rec.account_id,
                category_id=rec.category_id,
                payee_id=rec.payee_id,
                transfer_account_id=rec.transfer_account_id,
                recurring_id=rec.id,
                type=rec.type,
                amount_cents=rec.amount_cents,
                date=rec.next_date,
                description=rec.description,
                notes=rec.notes,
            )
            db.add(tx)
            created.append(tx)
            rec.next_date = next_occurrence(rec.next_date, rec.frequency, rec.interval)
            guard += 1
            if rec.end_date and rec.next_date > rec.end_date:
                rec.active = False
                break
    if created or recurring:
        db.commit()
    for tx in created:
        db.refresh(tx)
    return created


def goals_with_totals(db: Session, user_id: int) -> list[Goal]:
    return db.scalars(
        select(Goal)
        .options(selectinload(Goal.contributions))
        .where(Goal.user_id == user_id)
        .order_by(Goal.archived, Goal.created_at.desc())
    ).all()


# ------------------------------------------------------------------- validation
def owned_account(db: Session, user_id: int, account_id: int) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.user_id != user_id:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conto non trovato")
    return account


def owned_category(db: Session, user_id: int, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria non trovata")
    return category


def owned_payee(db: Session, user_id: int, payee_id: int) -> Payee:
    payee = db.get(Payee, payee_id)
    if payee is None or payee.user_id != user_id:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Beneficiario non trovato")
    return payee


def validate_transaction_links(
    db: Session,
    user_id: int,
    *,
    account_id: int,
    category_id: int | None,
    payee_id: int | None,
    transfer_account_id: int | None,
    tx_type: str,
) -> None:
    from fastapi import HTTPException, status

    account = owned_account(db, user_id, account_id)
    if account.archived:
        raise HTTPException(status_code=400, detail="Il conto selezionato è archiviato")
    if tx_type == "transfer":
        if not transfer_account_id:
            raise HTTPException(status_code=400, detail="Seleziona il conto di destinazione")
        if payee_id is not None:
            raise HTTPException(status_code=400, detail="Un trasferimento non ha un beneficiario")
        destination = owned_account(db, user_id, transfer_account_id)
        if destination.archived:
            raise HTTPException(status_code=400, detail="Il conto di destinazione è archiviato")
        return
    if category_id is not None:
        category = owned_category(db, user_id, category_id)
        expected = "income" if tx_type == "income" else "expense"
        if category.type != expected:
            raise HTTPException(
                status_code=400,
                detail="La categoria non è compatibile con il tipo di movimento",
            )
    if payee_id is not None:
        owned_payee(db, user_id, payee_id)


def transaction_with_relations(db: Session, tx_id: int) -> Transaction | None:
    return db.scalars(
        select(Transaction)
        .options(
            joinedload(Transaction.account),
            joinedload(Transaction.category),
            joinedload(Transaction.payee).joinedload(Payee.default_category),
            joinedload(Transaction.transfer_account),
        )
        .where(Transaction.id == tx_id)
    ).first()


def iter_months(start: str, end: str) -> Iterable[str]:
    cursor = start
    while cursor <= end:
        yield cursor
        cursor = shift_month(cursor, 1)
