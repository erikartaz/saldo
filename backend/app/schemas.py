from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

AccountType = Literal["checking", "savings", "cash", "credit_card", "investment", "other"]
TransactionType = Literal["income", "expense", "transfer"]
CategoryType = Literal["income", "expense"]
Frequency = Literal["daily", "weekly", "monthly", "yearly"]

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


# --------------------------------------------------------------------------- auth
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    currency: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SetupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ------------------------------------------------------------------------ accounts
class AccountBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: AccountType = "checking"
    initial_balance: float = 0.0
    color: str = "#0E7C66"
    icon: str = "wallet"
    notes: str | None = None
    sort_order: int = 0
    archived: bool = False

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith("#") or len(value) not in (4, 7):
            raise ValueError("Colore non valido")
        return value

    @field_validator("initial_balance")
    @classmethod
    def validate_initial_balance(cls, value: float) -> float:
        if abs(value) > 1_000_000_000:
            raise ValueError("Importo fuori intervallo")
        return round(value, 2)


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: AccountType | None = None
    initial_balance: float | None = None
    color: str | None = None
    icon: str | None = None
    notes: str | None = None
    sort_order: int | None = None
    archived: bool | None = None


class AccountRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    type: str


class AccountOut(BaseModel):
    id: int
    name: str
    type: str
    initial_balance: float
    balance: float
    currency: str
    color: str
    icon: str
    notes: str | None
    archived: bool
    sort_order: int
    transaction_count: int = 0
    created_at: datetime


# ---------------------------------------------------------------------- categories
class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    type: CategoryType
    color: str = "#64748B"
    icon: str = "tag"
    archived: bool = False

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith("#") or len(value) not in (4, 7):
            raise ValueError("Colore non valido")
        return value


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    type: CategoryType | None = None
    color: str | None = None
    icon: str | None = None
    archived: bool | None = None


class CategoryRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    icon: str


class CategoryOut(BaseModel):
    id: int
    name: str
    type: str
    color: str
    icon: str
    is_default: bool
    archived: bool
    transaction_count: int = 0
    budgeted: bool = False


# -------------------------------------------------------------------- transactions
class TransactionBase(BaseModel):
    type: TransactionType
    amount: float = Field(gt=0, le=1_000_000_000)
    date: date
    description: str = Field(min_length=1, max_length=200)
    account_id: int
    category_id: int | None = None
    transfer_account_id: int | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        if value != value or value in (float("inf"), float("-inf")):
            raise ValueError("Importo non valido")
        return round(value, 2)

    @model_validator(mode="after")
    def validate_shape(self):
        if self.type == "transfer":
            if not self.transfer_account_id:
                raise ValueError("Seleziona il conto di destinazione")
            if self.transfer_account_id == self.account_id:
                raise ValueError("I conti del trasferimento devono essere diversi")
            self.category_id = None
        else:
            self.transfer_account_id = None
        return self


class TransactionCreate(TransactionBase):
    pass


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    amount: float
    date: date
    description: str
    notes: str | None
    account_id: int
    account: AccountRef
    category_id: int | None
    category: CategoryRef | None
    transfer_account_id: int | None
    transfer_account: AccountRef | None
    recurring_id: int | None
    created_at: datetime


class TransactionTotals(BaseModel):
    income: float = 0
    expense: float = 0
    net: float = 0
    count: int = 0


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int
    totals: TransactionTotals


# ------------------------------------------------------------------------- budgets
class BudgetUpsert(BaseModel):
    category_id: int
    month: str = Field(pattern=MONTH_PATTERN)
    amount: float = Field(gt=0, le=1_000_000_000)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        return round(value, 2)


class BudgetOut(BaseModel):
    id: int
    month: str
    amount: float
    spent: float
    remaining: float
    percentage: float
    over_budget: bool
    category: CategoryRef


class BudgetSummary(BaseModel):
    month: str
    items: list[BudgetOut]
    total_budget: float
    total_spent: float
    total_remaining: float
    unbudgeted_spent: float
    categories_count: int
    over_budget_count: int


class BudgetCopy(BaseModel):
    from_month: str = Field(pattern=MONTH_PATTERN)
    to_month: str = Field(pattern=MONTH_PATTERN)


# ----------------------------------------------------------------------- recurring
class RecurringBase(BaseModel):
    type: TransactionType
    amount: float = Field(gt=0, le=1_000_000_000)
    description: str = Field(min_length=1, max_length=200)
    account_id: int
    category_id: int | None = None
    transfer_account_id: int | None = None
    notes: str | None = None
    frequency: Frequency = "monthly"
    interval: int = Field(default=1, ge=1, le=60)
    start_date: date
    end_date: date | None = None
    active: bool = True
    auto_post: bool = False

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        return round(value, 2)

    @model_validator(mode="after")
    def validate_shape(self):
        if self.type == "transfer":
            if not self.transfer_account_id:
                raise ValueError("Seleziona il conto di destinazione")
            if self.transfer_account_id == self.account_id:
                raise ValueError("I conti del trasferimento devono essere diversi")
            self.category_id = None
        else:
            self.transfer_account_id = None
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("La data di fine deve essere successiva alla data di inizio")
        return self


class RecurringCreate(RecurringBase):
    pass


class RecurringUpdate(BaseModel):
    type: TransactionType | None = None
    amount: float | None = Field(default=None, gt=0, le=1_000_000_000)
    description: str | None = Field(default=None, min_length=1, max_length=200)
    account_id: int | None = None
    category_id: int | None = None
    transfer_account_id: int | None = None
    notes: str | None = None
    frequency: Frequency | None = None
    interval: int | None = Field(default=None, ge=1, le=60)
    start_date: date | None = None
    end_date: date | None = None
    active: bool | None = None
    auto_post: bool | None = None


class RecurringOut(BaseModel):
    id: int
    type: str
    amount: float
    description: str
    notes: str | None
    frequency: str
    interval: int
    start_date: date
    next_date: date
    end_date: date | None
    active: bool
    auto_post: bool
    account_id: int
    account: AccountRef
    category_id: int | None
    category: CategoryRef | None
    transfer_account_id: int | None
    transfer_account: AccountRef | None
    monthly_equivalent: float
    created_at: datetime


class ForecastOccurrence(BaseModel):
    recurring_id: int
    date: date
    description: str
    type: str
    amount: float
    account_id: int
    account_name: str
    category_name: str | None
    category_color: str | None


class ForecastMonth(BaseModel):
    month: str
    label: str
    income: float
    expense: float
    net: float
    occurrences: list[ForecastOccurrence]


class ForecastOut(BaseModel):
    starting_balance: float
    months: list[ForecastMonth]
    projected_end_balance: float
    upcoming: list[ForecastOccurrence]


class PostDueOut(BaseModel):
    created: int
    transactions: list[TransactionOut]


# --------------------------------------------------------------------------- goals
class GoalBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target_amount: float = Field(gt=0, le=1_000_000_000)
    target_date: date | None = None
    color: str = "#0E7C66"
    icon: str = "target"
    notes: str | None = None
    archived: bool = False

    @field_validator("target_amount")
    @classmethod
    def validate_target(cls, value: float) -> float:
        return round(value, 2)


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    target_amount: float | None = Field(default=None, gt=0, le=1_000_000_000)
    target_date: date | None = None
    color: str | None = None
    icon: str | None = None
    notes: str | None = None
    archived: bool | None = None


class ContributionCreate(BaseModel):
    amount: float = Field(gt=0, le=1_000_000_000)
    date: date
    note: str | None = Field(default=None, max_length=200)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        return round(value, 2)


class ContributionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    date: date
    note: str | None


class GoalOut(BaseModel):
    id: int
    name: str
    target_amount: float
    contributed: float
    remaining: float
    percentage: float
    target_date: date | None
    color: str
    icon: str
    notes: str | None
    archived: bool
    is_reached: bool
    contributions_count: int
    contributions: list[ContributionOut] = []


# ------------------------------------------------------------------------ reports
class MonthPoint(BaseModel):
    month: str
    label: str
    income: float = 0
    expense: float = 0
    net: float = 0


class CategorySlice(BaseModel):
    category_id: int | None
    name: str
    color: str
    icon: str
    amount: float
    percentage: float
    count: int = 0


class NetWorthPoint(BaseModel):
    month: str
    label: str
    value: float


class TrendOut(BaseModel):
    months: list[MonthPoint]
    net_worth: list[NetWorthPoint]
    total_income: float
    total_expense: float
    average_income: float
    average_expense: float
    savings_rate: float


class CashflowOut(BaseModel):
    months: list[MonthPoint]
    forecast: list[ForecastMonth]
    starting_balance: float
    projected_end_balance: float


class CategoryReport(BaseModel):
    date_from: date
    date_to: date
    type: str
    total: float
    items: list[CategorySlice]
    average_transaction: float
    transaction_count: int


class DashboardOut(BaseModel):
    month: str
    net_worth: float
    month_income: float
    month_expense: float
    month_net: float
    savings_rate: float
    prev_income: float
    prev_expense: float
    income_change: float | None
    expense_change: float | None
    series: list[MonthPoint]
    categories: list[CategorySlice]
    budgets: BudgetSummary
    goals: list[GoalOut]
    upcoming: list[ForecastOccurrence]
    recent: list[TransactionOut]
    accounts: list[AccountOut]


class SettingsOut(BaseModel):
    currency: str
    categories_count: int
    transactions_count: int
    accounts_count: int
    database_size_kb: float
    version: str
