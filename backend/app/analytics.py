from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .models import Account, Category, Payee, Transaction
from .schemas import (
    AccountFlow,
    AccountsReportOut,
    BudgetHistoryOut,
    BudgetHistoryPoint,
    CalendarOut,
    CategoryRef,
    CategorySlice,
    DailySpendPoint,
    LargestExpense,
    MonthPoint,
    PayeeDetailOut,
    PayeeMonthlyPoint,
    PayeeRef,
    PayeeReportOut,
    PayeeStat,
    SummaryComparison,
    SummaryOut,
    SummaryValues,
    TransferCell,
    WeekdaySpendPoint,
)
from .services import (
    account_balances,
    add_months,
    budget_summary,
    current_month_key,
    from_cents,
    month_bounds,
    month_label,
    owned_payee,
    shift_month,
)

WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]


def _shift_year(value: date, delta: int) -> date:
    try:
        return value.replace(year=value.year + delta)
    except ValueError:
        return value.replace(year=value.year + delta, day=28)


def _days_inclusive(start: date, end: date) -> int:
    return max((end - start).days + 1, 1)


def _query_transactions(
    db: Session, user_id: int, start: date, end: date, include_transfers: bool = False
):
    query = (
        select(Transaction)
        .options(joinedload(Transaction.category), joinedload(Transaction.payee))
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )
    if not include_transfers:
        query = query.where(Transaction.type != "transfer")
    return db.scalars(query.order_by(Transaction.date, Transaction.id)).all()


def period_summary(db: Session, user_id: int, start: date, end: date) -> SummaryValues:
    rows = _query_transactions(db, user_id, start, end)
    income = 0
    expense = 0
    expense_count = 0
    recurring_expense = 0
    active_dates: set[date] = set()
    largest: Transaction | None = None

    for tx in rows:
        amount = int(tx.amount_cents)
        if tx.type == "income":
            income += amount
        elif tx.type == "expense":
            expense += amount
            expense_count += 1
            active_dates.add(tx.date)
            if tx.recurring_id is not None:
                recurring_expense += amount
            if largest is None or amount > largest.amount_cents:
                largest = tx

    savings_rate = round((income - expense) / income * 100, 1) if income else 0.0
    largest_expense = None
    if largest is not None:
        largest_expense = LargestExpense(
            amount=from_cents(largest.amount_cents),
            description=largest.description,
            date=largest.date,
            category_name=largest.category.name if largest.category else None,
        )

    return SummaryValues(
        income=from_cents(income),
        expense=from_cents(expense),
        net=from_cents(income - expense),
        savings_rate=savings_rate,
        transaction_count=len(rows),
        expense_count=expense_count,
        avg_expense=from_cents(round(expense / expense_count)) if expense_count else 0,
        daily_average=from_cents(round(expense / _days_inclusive(start, end))),
        active_days=len(active_dates),
        recurring_expense=from_cents(recurring_expense),
        recurring_share=round(recurring_expense / expense * 100, 1) if expense else 0,
        largest_expense=largest_expense,
    )


def _monthly_points_from_rows(rows: list[Transaction], start: date, end: date) -> list[MonthPoint]:
    buckets: dict[str, dict[str, int]] = {}
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        key = f"{cursor.year:04d}-{cursor.month:02d}"
        buckets[key] = {"income": 0, "expense": 0}
        cursor = add_months(cursor, 1)

    for tx in rows:
        key = f"{tx.date.year:04d}-{tx.date.month:02d}"
        if key not in buckets:
            continue
        if tx.type == "income":
            buckets[key]["income"] += int(tx.amount_cents)
        elif tx.type == "expense":
            buckets[key]["expense"] += int(tx.amount_cents)

    points: list[MonthPoint] = []
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        key = f"{cursor.year:04d}-{cursor.month:02d}"
        income = buckets[key]["income"]
        expense = buckets[key]["expense"]
        points.append(
            MonthPoint(
                month=key,
                label=month_label(key),
                income=from_cents(income),
                expense=from_cents(expense),
                net=from_cents(income - expense),
            )
        )
        cursor = add_months(cursor, 1)
    return points


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 1)


def summary_report(
    db: Session, user_id: int, start: date, end: date
) -> SummaryOut:
    days = _days_inclusive(start, end)
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    previous_year_start = _shift_year(start, -1)
    previous_year_end = _shift_year(end, -1)

    current = period_summary(db, user_id, start, end)
    previous = period_summary(db, user_id, previous_start, previous_end)
    previous_year = period_summary(db, user_id, previous_year_start, previous_year_end)
    rows = _query_transactions(db, user_id, start, end)

    return SummaryOut(
        date_from=start,
        date_to=end,
        comparison=SummaryComparison(
            current=current,
            previous=previous,
            previous_year=previous_year,
            income_change=_pct_change(current.income, previous.income),
            expense_change=_pct_change(current.expense, previous.expense),
            net_change=_pct_change(current.net, previous.net),
            savings_rate_change=round(current.savings_rate - previous.savings_rate, 1),
        ),
        series=_monthly_points_from_rows(rows, start, end),
    )


def calendar_report(db: Session, user_id: int, start: date, end: date) -> CalendarOut:
    rows = db.execute(
        select(Transaction.date, func.sum(Transaction.amount_cents), func.count(Transaction.id))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .group_by(Transaction.date)
    ).all()
    by_date = {tx_date: (int(amount or 0), int(count or 0)) for tx_date, amount, count in rows}

    daily: list[DailySpendPoint] = []
    weekday_amounts = [0] * 7
    weekday_counts = [0] * 7
    total = 0
    cursor = start
    while cursor <= end:
        amount, count = by_date.get(cursor, (0, 0))
        daily.append(DailySpendPoint(date=cursor, amount=from_cents(amount), count=count))
        weekday_amounts[cursor.weekday()] += amount
        weekday_counts[cursor.weekday()] += count
        total += amount
        cursor += timedelta(days=1)

    weekday = [
        WeekdaySpendPoint(
            weekday=index,
            label=WEEKDAYS[index],
            amount=from_cents(weekday_amounts[index]),
            count=weekday_counts[index],
        )
        for index in range(7)
    ]
    return CalendarOut(
        date_from=start,
        date_to=end,
        daily=daily,
        weekday=weekday,
        total=from_cents(total),
        active_days=len(by_date),
    )


def payee_report(
    db: Session,
    user_id: int,
    start: date,
    end: date,
    tx_type: str = "expense",
    limit: int = 10,
) -> PayeeReportOut:
    rows = db.execute(
        select(
            Transaction.payee_id,
            func.sum(Transaction.amount_cents),
            func.count(Transaction.id),
            func.max(Transaction.date),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.type == tx_type,
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .group_by(Transaction.payee_id)
    ).all()

    payee_ids = [row[0] for row in rows if row[0] is not None]
    payees = {
        payee.id: payee
        for payee in db.scalars(
            select(Payee)
            .options(joinedload(Payee.default_category))
            .where(Payee.id.in_(payee_ids))
        ).all()
    } if payee_ids else {}

    total = sum(int(row[1] or 0) for row in rows)
    items: list[PayeeStat] = []
    for payee_id, amount, count, last_used in rows:
        amount = int(amount or 0)
        payee = payees.get(payee_id) if payee_id is not None else None
        items.append(
            PayeeStat(
                payee_id=payee_id,
                name=payee.name if payee else "Senza beneficiario",
                default_category=CategoryRef.model_validate(payee.default_category)
                if payee and payee.default_category
                else None,
                amount=from_cents(amount),
                count=int(count or 0),
                average=from_cents(round(amount / count)) if count else 0,
                percentage=round(amount / total * 100, 1) if total else 0,
                last_used=last_used,
            )
        )

    items.sort(key=lambda item: item.amount, reverse=True)
    top5 = sum(item.amount for item in items[:5])
    unassigned = next((item.amount for item in items if item.payee_id is None), 0)
    return PayeeReportOut(
        date_from=start,
        date_to=end,
        type=tx_type,
        total=from_cents(total),
        items=items[:limit],
        top5_share=round(top5 / from_cents(total) * 100, 1) if total else 0,
        unassigned_amount=unassigned,
    )


def payee_detail(
    db: Session,
    user_id: int,
    payee_id: int,
    start: date,
    end: date,
    tx_type: str = "expense",
) -> PayeeDetailOut:
    payee = owned_payee(db, user_id, payee_id)
    rows = db.scalars(
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(
            Transaction.user_id == user_id,
            Transaction.payee_id == payee_id,
            Transaction.type == tx_type,
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .order_by(Transaction.date)
    ).all()

    total = sum(int(tx.amount_cents) for tx in rows)
    months: dict[str, dict[str, int]] = {}
    categories: dict[int | None, tuple[int, int]] = {}
    for tx in rows:
        key = f"{tx.date.year:04d}-{tx.date.month:02d}"
        bucket = months.setdefault(key, {"amount": 0, "count": 0})
        bucket["amount"] += int(tx.amount_cents)
        bucket["count"] += 1
        entry = categories.get(tx.category_id, (0, 0))
        categories[tx.category_id] = (entry[0] + int(tx.amount_cents), entry[1] + 1)

    monthly = [
        PayeeMonthlyPoint(
            month=key,
            label=month_label(key),
            amount=from_cents(value["amount"]),
            count=value["count"],
        )
        for key, value in sorted(months.items())
    ]

    category_ids = [category_id for category_id in categories if category_id is not None]
    category_map = {
        category.id: category
        for category in db.scalars(select(Category).where(Category.id.in_(category_ids))).all()
    } if category_ids else {}
    category_slices: list[CategorySlice] = []
    for category_id, (amount, count) in categories.items():
        category = category_map.get(category_id) if category_id is not None else None
        category_slices.append(
            CategorySlice(
                category_id=category_id,
                name=category.name if category else "Senza categoria",
                color=category.color if category else "#94A3B8",
                icon=category.icon if category else "circle-help",
                amount=from_cents(amount),
                percentage=round(amount / total * 100, 1) if total else 0,
                count=count,
            )
        )
    category_slices.sort(key=lambda item: item.amount, reverse=True)
    last_used = max((tx.date for tx in rows), default=None)

    return PayeeDetailOut(
        date_from=start,
        date_to=end,
        payee=PayeeRef.model_validate(payee),
        total=from_cents(total),
        count=len(rows),
        average=from_cents(round(total / len(rows))) if rows else 0,
        monthly=monthly,
        categories=category_slices,
        last_used=last_used,
    )


def accounts_report(db: Session, user_id: int, start: date, end: date) -> AccountsReportOut:
    accounts = db.scalars(
        select(Account)
        .where(Account.user_id == user_id, Account.archived.is_(False))
        .order_by(Account.sort_order, Account.id)
    ).all()
    active_ids = {account.id for account in accounts}
    balances = account_balances(db, user_id)

    flows: dict[int, dict[str, int]] = {
        account.id: {"income": 0, "expense": 0, "transfer_in": 0, "transfer_out": 0}
        for account in accounts
    }
    rows = db.scalars(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
        )
    ).all()

    matrix: dict[tuple[int, int], dict[str, int]] = {}
    for tx in rows:
        amount = int(tx.amount_cents)
        if tx.type == "transfer":
            if tx.account_id in active_ids:
                flows[tx.account_id]["transfer_out"] += amount
            if tx.transfer_account_id in active_ids:
                flows[tx.transfer_account_id]["transfer_in"] += amount
            if tx.account_id in active_ids and tx.transfer_account_id in active_ids:
                key = (tx.account_id, tx.transfer_account_id)
                cell = matrix.setdefault(key, {"amount": 0, "count": 0})
                cell["amount"] += amount
                cell["count"] += 1
        elif tx.account_id in active_ids:
            flows[tx.account_id][tx.type] += amount

    account_rows: list[AccountFlow] = []
    for account in accounts:
        flow = flows[account.id]
        net = flow["income"] - flow["expense"] - flow["transfer_out"] + flow["transfer_in"]
        account_rows.append(
            AccountFlow(
                id=account.id,
                name=account.name,
                type=account.type,
                color=account.color,
                balance=from_cents(balances.get(account.id, 0)),
                income=from_cents(flow["income"]),
                expense=from_cents(flow["expense"]),
                transfer_in=from_cents(flow["transfer_in"]),
                transfer_out=from_cents(flow["transfer_out"]),
                net=from_cents(net),
            )
        )

    names = {account.id: account.name for account in accounts}
    transfers = [
        TransferCell(
            from_account_id=from_id,
            from_account_name=names[from_id],
            to_account_id=to_id,
            to_account_name=names[to_id],
            amount=from_cents(cell["amount"]),
            count=cell["count"],
        )
        for (from_id, to_id), cell in matrix.items()
    ]
    transfers.sort(key=lambda item: item.amount, reverse=True)

    return AccountsReportOut(
        date_from=start,
        date_to=end,
        total_balance=from_cents(sum(balances.get(account.id, 0) for account in accounts)),
        accounts=account_rows,
        transfers=transfers,
    )


def budget_history(db: Session, user_id: int, months: int = 6) -> BudgetHistoryOut:
    current = current_month_key()
    points: list[BudgetHistoryPoint] = []
    for offset in range(months - 1, -1, -1):
        key = shift_month(current, -offset)
        summary = budget_summary(db, user_id, key)
        utilization = (
            round(summary.total_spent / summary.total_budget * 100, 1)
            if summary.total_budget
            else 0
        )
        points.append(
            BudgetHistoryPoint(
                month=key,
                label=month_label(key),
                total_budget=summary.total_budget,
                total_spent=summary.total_spent,
                remaining=summary.total_remaining,
                over_count=summary.over_budget_count,
                adherence=utilization,
            )
        )
    return BudgetHistoryOut(months=points)
