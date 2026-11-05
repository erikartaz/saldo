export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card' | 'investment' | 'other'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type CategoryType = 'income' | 'expense'
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface User {
  id: number
  name: string
  email: string
  currency: string
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface AccountRef {
  id: number
  name: string
  color: string
  type: string
}

export interface CategoryRef {
  id: number
  name: string
  color: string
  icon: string
  type: CategoryType
}

export interface PayeeRef {
  id: number
  name: string
  default_category: CategoryRef | null
}

export interface Payee {
  id: number
  name: string
  default_category_id: number | null
  default_category: CategoryRef | null
  notes: string | null
  archived: boolean
  transaction_count: number
  expense_total: number
  income_total: number
  last_used: string | null
  created_at: string
}

export interface SuggestionItem {
  value: string
  category_name: string | null
  count: number
  last_used: string | null
}

export interface Account {
  id: number
  name: string
  type: AccountType
  initial_balance: number
  balance: number
  currency: string
  color: string
  icon: string
  notes: string | null
  archived: boolean
  sort_order: number
  transaction_count: number
  created_at: string
}

export interface Category {
  id: number
  name: string
  type: CategoryType
  color: string
  icon: string
  is_default: boolean
  archived: boolean
  transaction_count: number
  budgeted: boolean
}

export interface Transaction {
  id: number
  type: TransactionType
  amount: number
  date: string
  description: string
  notes: string | null
  account_id: number
  account: AccountRef
  category_id: number | null
  category: CategoryRef | null
  payee_id: number | null
  payee: PayeeRef | null
  transfer_account_id: number | null
  transfer_account: AccountRef | null
  recurring_id: number | null
  created_at: string
}

export interface TransactionTotals {
  income: number
  expense: number
  net: number
  count: number
}

export interface TransactionPage {
  items: Transaction[]
  total: number
  page: number
  page_size: number
  totals: TransactionTotals
}

export interface BudgetItem {
  id: number
  month: string
  amount: number
  spent: number
  remaining: number
  percentage: number
  over_budget: boolean
  category: CategoryRef
}

export interface BudgetSummary {
  month: string
  items: BudgetItem[]
  total_budget: number
  total_spent: number
  total_remaining: number
  unbudgeted_spent: number
  categories_count: number
  over_budget_count: number
}

export interface Recurring {
  id: number
  type: TransactionType
  amount: number
  description: string
  notes: string | null
  frequency: Frequency
  interval: number
  start_date: string
  next_date: string
  end_date: string | null
  active: boolean
  auto_post: boolean
  account_id: number
  account: AccountRef
  category_id: number | null
  category: CategoryRef | null
  payee_id: number | null
  payee: PayeeRef | null
  transfer_account_id: number | null
  transfer_account: AccountRef | null
  monthly_equivalent: number
  created_at: string
}

export interface ForecastOccurrence {
  recurring_id: number
  date: string
  description: string
  type: TransactionType
  amount: number
  account_id: number
  account_name: string
  category_name: string | null
  category_color: string | null
}

export interface ForecastMonth {
  month: string
  label: string
  income: number
  expense: number
  net: number
  occurrences: ForecastOccurrence[]
}

export interface Forecast {
  starting_balance: number
  months: ForecastMonth[]
  projected_end_balance: number
  upcoming: ForecastOccurrence[]
}

export interface GoalContribution {
  id: number
  amount: number
  date: string
  note: string | null
}

export interface Goal {
  id: number
  name: string
  target_amount: number
  contributed: number
  remaining: number
  percentage: number
  target_date: string | null
  color: string
  icon: string
  notes: string | null
  archived: boolean
  is_reached: boolean
  contributions_count: number
  contributions: GoalContribution[]
}

export interface MonthPoint {
  month: string
  label: string
  income: number
  expense: number
  net: number
}

export interface CategorySlice {
  category_id: number | null
  name: string
  color: string
  icon: string
  amount: number
  percentage: number
  count: number
}

export interface NetWorthPoint {
  month: string
  label: string
  value: number
}

export interface Trend {
  months: MonthPoint[]
  net_worth: NetWorthPoint[]
  total_income: number
  total_expense: number
  average_income: number
  average_expense: number
  savings_rate: number
}

export interface Cashflow {
  months: MonthPoint[]
  forecast: ForecastMonth[]
  starting_balance: number
  projected_end_balance: number
}

export interface CategoryReport {
  date_from: string
  date_to: string
  type: CategoryType
  total: number
  items: CategorySlice[]
  average_transaction: number
  transaction_count: number
}

export interface Dashboard {
  month: string
  net_worth: number
  month_income: number
  month_expense: number
  month_net: number
  savings_rate: number
  prev_income: number
  prev_expense: number
  income_change: number | null
  expense_change: number | null
  series: MonthPoint[]
  categories: CategorySlice[]
  budgets: BudgetSummary
  goals: Goal[]
  upcoming: ForecastOccurrence[]
  recent: Transaction[]
  accounts: Account[]
}

export interface AppSettings {
  currency: string
  categories_count: number
  transactions_count: number
  accounts_count: number
  database_size_kb: number
  version: string
}

export interface AuthStatus {
  needs_setup: boolean
}

export interface LargestExpense {
  amount: number
  description: string
  date: string
  category_name: string | null
}

export interface SummaryValues {
  income: number
  expense: number
  net: number
  savings_rate: number
  transaction_count: number
  expense_count: number
  avg_expense: number
  daily_average: number
  active_days: number
  recurring_expense: number
  recurring_share: number
  largest_expense: LargestExpense | null
}

export interface SummaryComparison {
  current: SummaryValues
  previous: SummaryValues
  previous_year: SummaryValues
  income_change: number | null
  expense_change: number | null
  net_change: number | null
  savings_rate_change: number | null
}

export interface Summary {
  date_from: string
  date_to: string
  comparison: SummaryComparison
  series: MonthPoint[]
}

export interface DailySpendPoint {
  date: string
  amount: number
  count: number
}

export interface WeekdaySpendPoint {
  weekday: number
  label: string
  amount: number
  count: number
}

export interface CalendarStats {
  date_from: string
  date_to: string
  daily: DailySpendPoint[]
  weekday: WeekdaySpendPoint[]
  total: number
  active_days: number
}

export interface PayeeStat {
  payee_id: number | null
  name: string
  default_category: CategoryRef | null
  amount: number
  count: number
  average: number
  percentage: number
  last_used: string | null
}

export interface PayeeReport {
  date_from: string
  date_to: string
  type: CategoryType
  total: number
  items: PayeeStat[]
  top5_share: number
  unassigned_amount: number
}

export interface PayeeMonthlyPoint {
  month: string
  label: string
  amount: number
  count: number
}

export interface PayeeDetail {
  date_from: string
  date_to: string
  payee: PayeeRef
  total: number
  count: number
  average: number
  monthly: PayeeMonthlyPoint[]
  categories: CategorySlice[]
  last_used: string | null
}

export interface AccountFlow {
  id: number
  name: string
  type: string
  color: string
  balance: number
  income: number
  expense: number
  transfer_in: number
  transfer_out: number
  net: number
}

export interface TransferCell {
  from_account_id: number
  from_account_name: string
  to_account_id: number
  to_account_name: string
  amount: number
  count: number
}

export interface AccountsReport {
  date_from: string
  date_to: string
  total_balance: number
  accounts: AccountFlow[]
  transfers: TransferCell[]
}

export interface BudgetHistoryPoint {
  month: string
  label: string
  total_budget: number
  total_spent: number
  remaining: number
  over_count: number
  adherence: number
}

export interface BudgetHistory {
  months: BudgetHistoryPoint[]
}

export interface TransactionInput {
  type: TransactionType
  amount: number
  date: string
  description: string
  account_id: number
  category_id: number | null
  payee_id: number | null
  transfer_account_id: number | null
  notes: string | null
}
