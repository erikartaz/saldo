from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..analytics import (
    accounts_report,
    budget_history,
    calendar_report,
    payee_detail,
    payee_report,
    summary_report,
)
from ..database import get_db
from ..deps import get_current_user
from ..models import Account, Budget, Category, Goal, GoalContribution, Payee, RecurringTransaction, Transaction, User
from ..schemas import (
    AccountsReportOut,
    BudgetHistoryOut,
    CalendarOut,
    CashflowOut,
    CategoryReport,
    DashboardOut,
    ForecastMonth,
    MonthPoint,
    PayeeDetailOut,
    PayeeReportOut,
    SummaryOut,
    TrendOut,
)
from ..serializers import account_out, goal_out, transaction_out
from ..services import (
    account_balances,
    account_transaction_counts,
    budget_summary,
    category_breakdown,
    forecast,
    from_cents,
    goals_with_totals,
    month_bounds,
    month_label,
    monthly_series,
    net_worth_series,
    previous_month,
    range_totals,
    total_balance,
)
from ..services import current_month_key

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _pct_change(current: int, previous: int) -> float | None:
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 1)


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    month: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardOut:
    month = month or current_month_key()
    try:
        start, end = month_bounds(month)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Mese non valido, usa il formato YYYY-MM") from None
    prev = previous_month(month)
    p_start, p_end = month_bounds(prev)

    income, expense = range_totals(db, user.id, start, end)
    prev_income, prev_expense = range_totals(db, user.id, p_start, p_end)

    accounts = db.scalars(
        select(Account)
        .where(Account.user_id == user.id, Account.archived.is_(False))
        .order_by(Account.sort_order, Account.id)
    ).all()
    balances = account_balances(db, user.id)
    counts = account_transaction_counts(db, user.id)
    net_worth = sum(balances.get(account.id, 0) for account in accounts)

    _, upcoming, _ = forecast(db, user.id, 3)
    recent = db.scalars(
        select(Transaction)
        .options(
            joinedload(Transaction.account),
            joinedload(Transaction.category),
            joinedload(Transaction.payee),
            joinedload(Transaction.transfer_account),
        )
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(5)
    ).all()

    savings_rate = round((income - expense) / income * 100, 1) if income else 0.0
    goals = [goal_out(goal) for goal in goals_with_totals(db, user.id) if not goal.archived][:3]

    return DashboardOut(
        month=month,
        net_worth=from_cents(net_worth),
        month_income=from_cents(income),
        month_expense=from_cents(expense),
        month_net=from_cents(income - expense),
        savings_rate=savings_rate,
        prev_income=from_cents(prev_income),
        prev_expense=from_cents(prev_expense),
        income_change=_pct_change(income, prev_income),
        expense_change=_pct_change(expense, prev_expense),
        series=monthly_series(db, user.id, 6, month),
        categories=category_breakdown(db, user.id, start, end),
        budgets=budget_summary(db, user.id, month),
        goals=goals,
        upcoming=upcoming[:6],
        recent=[transaction_out(tx) for tx in recent],
        accounts=[account_out(account, balances.get(account.id, 0), counts.get(account.id, 0)) for account in accounts],
    )


@router.get("/trend", response_model=TrendOut)
def trend(
    months: int = Query(default=12, ge=1, le=36),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TrendOut:
    series = monthly_series(db, user.id, months)
    net_worth = net_worth_series(db, user.id, months)
    total_income = round(sum(item.income for item in series), 2)
    total_expense = round(sum(item.expense for item in series), 2)
    savings_rate = round((total_income - total_expense) / total_income * 100, 1) if total_income else 0.0
    return TrendOut(
        months=series,
        net_worth=net_worth,
        total_income=total_income,
        total_expense=total_expense,
        average_income=round(total_income / months, 2),
        average_expense=round(total_expense / months, 2),
        savings_rate=savings_rate,
    )


@router.get("/categories", response_model=CategoryReport)
def category_report(
    date_from: date | None = None,
    date_to: date | None = None,
    tx_type: str = Query(default="expense", alias="type", pattern="^(income|expense)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CategoryReport:
    today = date.today()
    if date_from is None and date_to is None:
        start, end = month_bounds(current_month_key())
        date_from, date_to = start, end - timedelta(days=1)
    else:
        date_from = date_from or today.replace(day=1)
        date_to = date_to or today
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="La data iniziale deve precedere quella finale")

    items = category_breakdown(db, user.id, date_from, date_to + timedelta(days=1), tx_type)
    total = round(sum(item.amount for item in items), 2)
    count = sum(item.count for item in items)
    return CategoryReport(
        date_from=date_from,
        date_to=date_to,
        type=tx_type,
        total=total,
        items=items,
        average_transaction=round(total / count, 2) if count else 0,
        transaction_count=count,
    )


@router.get("/cashflow", response_model=CashflowOut)
def cashflow(
    history_months: int = Query(default=6, ge=1, le=24),
    forecast_months: int = Query(default=3, ge=1, le=12),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CashflowOut:
    series = monthly_series(db, user.id, history_months)
    forecast_data, _, starting = forecast(db, user.id, forecast_months)
    return CashflowOut(
        months=series,
        forecast=forecast_data,
        starting_balance=from_cents(starting),
        projected_end_balance=from_cents(starting + sum(int(round(item.net * 100)) for item in forecast_data)),
    )


def _resolve_range(date_from: date | None, date_to: date | None) -> tuple[date, date]:
    today = date.today()
    start = date_from or today.replace(day=1)
    end = date_to or today
    if start > end:
        raise HTTPException(status_code=400, detail="La data iniziale deve precedere quella finale")
    return start, end


@router.get("/summary", response_model=SummaryOut)
def summary(
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SummaryOut:
    start, end = _resolve_range(date_from, date_to)
    return summary_report(db, user.id, start, end)


@router.get("/calendar", response_model=CalendarOut)
def calendar(
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CalendarOut:
    start, end = _resolve_range(date_from, date_to)
    return calendar_report(db, user.id, start, end)


@router.get("/payees", response_model=PayeeReportOut)
def payees_report(
    date_from: date | None = None,
    date_to: date | None = None,
    tx_type: str = Query(default="expense", alias="type", pattern="^(income|expense)$"),
    limit: int = Query(default=10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayeeReportOut:
    start, end = _resolve_range(date_from, date_to)
    return payee_report(db, user.id, start, end, tx_type=tx_type, limit=limit)


@router.get("/payees/{payee_id}", response_model=PayeeDetailOut)
def payee_statistics(
    payee_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    tx_type: str = Query(default="expense", alias="type", pattern="^(income|expense)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayeeDetailOut:
    start, end = _resolve_range(date_from, date_to)
    return payee_detail(db, user.id, payee_id, start, end, tx_type=tx_type)


@router.get("/accounts", response_model=AccountsReportOut)
def accounts_statistics(
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccountsReportOut:
    start, end = _resolve_range(date_from, date_to)
    return accounts_report(db, user.id, start, end)


@router.get("/budget-history", response_model=BudgetHistoryOut)
def budgets_history(
    months: int = Query(default=6, ge=1, le=24),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetHistoryOut:
    return budget_history(db, user.id, months)


def _tx_type_label(value: str) -> str:
    return {"income": "Entrata", "expense": "Spesa", "transfer": "Trasferimento"}.get(value, value)


@router.get("/export.csv")
def export_csv(
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    query = (
        select(Transaction)
        .options(
            joinedload(Transaction.account),
            joinedload(Transaction.category),
            joinedload(Transaction.payee),
            joinedload(Transaction.transfer_account),
        )
        .where(Transaction.user_id == user.id)
    )
    if date_from:
        query = query.where(Transaction.date >= date_from)
    if date_to:
        query = query.where(Transaction.date <= date_to)
    transactions = db.scalars(query.order_by(Transaction.date, Transaction.id)).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(
        [
            "Data",
            "Tipo",
            "Importo (EUR)",
            "Descrizione",
            "Conto",
            "Categoria",
            "Beneficiario",
            "Conto destinazione",
            "Note",
        ]
    )
    for tx in transactions:
        writer.writerow(
            [
                tx.date.isoformat(),
                _tx_type_label(tx.type),
                f"{from_cents(tx.amount_cents):.2f}".replace(".", ","),
                tx.description,
                tx.account.name if tx.account else "",
                tx.category.name if tx.category else "",
                tx.payee.name if tx.payee else "",
                tx.transfer_account.name if tx.transfer_account else "",
                tx.notes or "",
            ]
        )
    content = "\ufeff" + buffer.getvalue()
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="saldo-movimenti.csv"'},
    )


def _iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


@router.get("/export.json")
def export_json(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    import json

    accounts = db.scalars(select(Account).where(Account.user_id == user.id)).all()
    categories = db.scalars(select(Category).where(Category.user_id == user.id)).all()
    payees = db.scalars(select(Payee).where(Payee.user_id == user.id)).all()
    transactions = db.scalars(
        select(Transaction).where(Transaction.user_id == user.id).order_by(Transaction.date)
    ).all()
    budgets = db.scalars(select(Budget).where(Budget.user_id == user.id)).all()
    recurring = db.scalars(select(RecurringTransaction).where(RecurringTransaction.user_id == user.id)).all()
    goals = db.scalars(
        select(Goal).options(selectinload(Goal.contributions)).where(Goal.user_id == user.id)
    ).all()

    payload = {
        "app": "Saldo",
        "version": "1.0.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {"name": user.name, "email": user.email, "currency": user.currency},
        "accounts": [
            {
                "id": a.id,
                "name": a.name,
                "type": a.type,
                "initial_balance": from_cents(a.initial_balance_cents),
                "currency": a.currency,
                "color": a.color,
                "icon": a.icon,
                "notes": a.notes,
                "archived": a.archived,
            }
            for a in accounts
        ],
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "type": c.type,
                "color": c.color,
                "icon": c.icon,
                "archived": c.archived,
            }
            for c in categories
        ],
        "payees": [
            {
                "id": p.id,
                "name": p.name,
                "default_category_id": p.default_category_id,
                "notes": p.notes,
                "archived": p.archived,
            }
            for p in payees
        ],
        "transactions": [
            {
                "id": t.id,
                "date": t.date.isoformat(),
                "type": t.type,
                "amount": from_cents(t.amount_cents),
                "description": t.description,
                "notes": t.notes,
                "account_id": t.account_id,
                "category_id": t.category_id,
                "payee_id": t.payee_id,
                "transfer_account_id": t.transfer_account_id,
                "recurring_id": t.recurring_id,
            }
            for t in transactions
        ],
        "budgets": [
            {"id": b.id, "month": b.month, "category_id": b.category_id, "amount": from_cents(b.amount_cents)}
            for b in budgets
        ],
        "recurring": [
            {
                "id": r.id,
                "type": r.type,
                "amount": from_cents(r.amount_cents),
                "description": r.description,
                "payee_id": r.payee_id,
                "frequency": r.frequency,
                "interval": r.interval,
                "start_date": r.start_date.isoformat(),
                "next_date": r.next_date.isoformat(),
                "end_date": _iso(r.end_date),
                "active": r.active,
            }
            for r in recurring
        ],
        "goals": [
            {
                "id": g.id,
                "name": g.name,
                "target_amount": from_cents(g.target_amount_cents),
                "target_date": _iso(g.target_date),
                "contributions": [
                    {
                        "id": c.id,
                        "amount": from_cents(c.amount_cents),
                        "date": c.date.isoformat(),
                        "note": c.note,
                    }
                    for c in g.contributions
                ],
            }
            for g in goals
        ],
    }
    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="saldo-backup.json"'},
    )
