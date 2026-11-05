import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Download,
  FileJson,
  PiggyBank,
  Repeat2,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import type {
  AccountsReport,
  BudgetHistory,
  CalendarStats,
  Cashflow,
  CategoryReport,
  CategoryType,
  MonthPoint,
  PayeeDetail,
  PayeeReport,
  PayeeStat,
  Summary,
  Trend,
} from '../types'
import { useToast } from '../context/ToastContext'
import {
  formatCurrency,
  formatDate,
  formatPercent,
} from '../lib/format'
import { cn, currentMonth, monthLabel, monthRange, shiftMonth, todayISO } from '../lib/utils'
import { AppIcon } from '../lib/icons'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import {
  Badge,
  EmptyState,
  PageHeader,
  Progress,
  SegmentedControl,
  Skeleton,
  StatCard,
} from '../components/ui/Primitives'
import {
  BudgetHistoryChart,
  CategoryDonut,
  ForecastChart,
  MonthlyBars,
  NetWorthChart,
  PayeeMonthlyBars,
  WeekdayChart,
} from '../components/charts/Charts'

type Tab = 'overview' | 'categories' | 'payees' | 'accounts' | 'budgets' | 'calendar' | 'forecast'
type Preset = 'this-month' | 'last-month' | '3m' | '6m' | '12m' | 'year' | 'custom'
type ComparisonMode = 'previous' | 'year'

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Panoramica' },
  { value: 'categories', label: 'Categorie' },
  { value: 'payees', label: 'Beneficiari' },
  { value: 'accounts', label: 'Conti' },
  { value: 'budgets', label: 'Budget' },
  { value: 'calendar', label: 'Calendario' },
  { value: 'forecast', label: 'Previsioni' },
]

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'this-month', label: 'Questo mese' },
  { value: 'last-month', label: 'Mese scorso' },
  { value: '3m', label: '3 mesi' },
  { value: '6m', label: '6 mesi' },
  { value: '12m', label: '12 mesi' },
  { value: 'year', label: 'Anno corrente' },
]

function rangeForPreset(preset: Preset): { from: string; to: string } {
  const current = currentMonth()
  if (preset === 'this-month') return { from: monthRange(current).from, to: todayISO() }
  if (preset === 'last-month') return monthRange(shiftMonth(current, -1))
  if (preset === '3m') {
    return { from: monthRange(shiftMonth(current, -2)).from, to: todayISO() }
  }
  if (preset === '6m') {
    return { from: monthRange(shiftMonth(current, -5)).from, to: todayISO() }
  }
  if (preset === '12m') {
    return { from: monthRange(shiftMonth(current, -11)).from, to: todayISO() }
  }
  if (preset === 'year') {
    return { from: `${new Date().getFullYear()}-01-01`, to: todayISO() }
  }
  return { from: monthRange(current).from, to: todayISO() }
}

function pctChange(current: number, base: number): number | null {
  if (base === 0) return null
  return Math.round(((current - base) / base) * 1000) / 10
}

function shortRangeLabel(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`
}

function CalendarHeatmap({ data }: { data: CalendarStats }) {
  const amountByDate = useMemo(
    () => new Map(data.daily.map((item) => [item.date, item.amount])),
    [data.daily],
  )
  const max = Math.max(...data.daily.map((item) => item.amount), 1)
  const start = new Date(`${data.date_from}T00:00:00`)
  const end = new Date(`${data.date_to}T00:00:00`)
  const days: (string | null)[] = []
  const leading = (start.getDay() + 6) % 7
  for (let index = 0; index < leading; index += 1) days.push(null)
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    days.push(key)
    cursor.setDate(cursor.getDate() + 1)
  }
  while (days.length % 7 !== 0) days.push(null)
  const weeks: (string | null)[][] = []
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7))

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <div className="grid shrink-0 grid-rows-7 gap-1 pt-0.5 text-[9px] font-medium text-muted">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
          <span key={day} className="flex h-3.5 items-center">
            {day}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-rows-7 gap-1">
            {week.map((day, dayIndex) => {
              if (!day) return <span key={dayIndex} className="h-3.5 w-3.5" />
              const amount = amountByDate.get(day) ?? 0
              const intensity = amount > 0 ? 0.16 + (amount / max) * 0.84 : 0
              return (
                <span
                  key={day}
                  title={`${formatDate(day)} · ${formatCurrency(amount)}`}
                  className="h-3.5 w-3.5 rounded-[3px] border border-line/40"
                  style={{
                    backgroundColor:
                      amount > 0
                        ? `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, var(--surface-2))`
                        : 'var(--surface-2)',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="num mt-1 text-[15px] font-bold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted">{hint}</p> : null}
    </div>
  )
}

function PayeeDetailModal({
  payee,
  range,
  onClose,
}: {
  payee: PayeeStat | null
  range: { from: string; to: string }
  onClose: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['payee-detail', payee?.payee_id, range.from, range.to],
    queryFn: () =>
      api.get<PayeeDetail>(`/reports/payees/${payee?.payee_id}`, {
        date_from: range.from,
        date_to: range.to,
        type: 'expense',
      }),
    enabled: Boolean(payee?.payee_id),
  })

  return (
    <Modal
      open={payee !== null}
      onClose={onClose}
      title={payee?.name ?? 'Beneficiario'}
      description={payee ? shortRangeLabel(range.from, range.to) : undefined}
      size="lg"
    >
      {isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DetailStat label="Totale" value={formatCurrency(data.total)} />
            <DetailStat label="Movimenti" value={String(data.count)} />
            <DetailStat label="Media" value={formatCurrency(data.average)} />
            <DetailStat
              label="Ultimo acquisto"
              value={data.last_used ? formatDate(data.last_used) : '—'}
            />
          </div>

          <div>
            <h3 className="mb-2 text-[13px] font-bold text-ink">Andamento mensile</h3>
            <PayeeMonthlyBars data={data.monthly} />
          </div>

          <div>
            <h3 className="mb-2 text-[13px] font-bold text-ink">Categorie</h3>
            <div className="space-y-2">
              {data.categories.map((category) => (
                <div key={`${category.category_id}-${category.name}`} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="flex-1 truncate text-[12px] text-muted">{category.name}</span>
                  <span className="num text-[12px] font-semibold text-ink">
                    {formatCurrency(category.amount)}
                  </span>
                  <span className="num w-10 text-right text-[10px] text-muted">
                    {formatPercent(category.percentage, 0)}
                  </span>
                </div>
              ))}
              {data.categories.length === 0 ? (
                <p className="text-xs text-muted">Nessuna categoria nel periodo.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function StatisticsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('overview')
  const [preset, setPreset] = useState<Preset>('this-month')
  const [range, setRange] = useState(() => rangeForPreset('this-month'))
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('previous')
  const [categoryType, setCategoryType] = useState<CategoryType>('expense')
  const [selectedPayee, setSelectedPayee] = useState<PayeeStat | null>(null)
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null)

  const applyPreset = (next: Preset) => {
    setPreset(next)
    if (next !== 'custom') setRange(rangeForPreset(next))
  }

  const summaryQuery = useQuery({
    queryKey: ['stats-summary', range.from, range.to],
    queryFn: () => api.get<Summary>('/reports/summary', { date_from: range.from, date_to: range.to }),
  })
  const trendQuery = useQuery({
    queryKey: ['stats-trend'],
    queryFn: () => api.get<Trend>('/reports/trend', { months: 12 }),
  })
  const categoriesQuery = useQuery({
    queryKey: ['stats-categories', range.from, range.to, categoryType],
    queryFn: () =>
      api.get<CategoryReport>('/reports/categories', {
        date_from: range.from,
        date_to: range.to,
        type: categoryType,
      }),
  })
  const payeesQuery = useQuery({
    queryKey: ['stats-payees', range.from, range.to],
    queryFn: () =>
      api.get<PayeeReport>('/reports/payees', {
        date_from: range.from,
        date_to: range.to,
        type: 'expense',
        limit: 15,
      }),
  })
  const accountsQuery = useQuery({
    queryKey: ['stats-accounts', range.from, range.to],
    queryFn: () =>
      api.get<AccountsReport>('/reports/accounts', { date_from: range.from, date_to: range.to }),
  })
  const budgetsQuery = useQuery({
    queryKey: ['stats-budgets'],
    queryFn: () => api.get<BudgetHistory>('/reports/budget-history', { months: 6 }),
  })
  const calendarQuery = useQuery({
    queryKey: ['stats-calendar', range.from, range.to],
    queryFn: () =>
      api.get<CalendarStats>('/reports/calendar', { date_from: range.from, date_to: range.to }),
  })
  const cashflowQuery = useQuery({
    queryKey: ['stats-cashflow'],
    queryFn: () => api.get<Cashflow>('/reports/cashflow', { history_months: 6, forecast_months: 3 }),
  })

  const summary = summaryQuery.data
  const comparison = summary
    ? comparisonMode === 'previous'
      ? summary.comparison.previous
      : summary.comparison.previous_year
    : null
  const comparisonLabel = comparisonMode === 'previous' ? 'periodo precedente' : 'anno precedente'
  const current = summary?.comparison.current
  const categories = categoriesQuery.data
  const payees = payeesQuery.data
  const accounts = accountsQuery.data
  const budgets = budgetsQuery.data
  const calendar = calendarQuery.data
  const cashflow = cashflowQuery.data

  const handleExport = async (kind: 'csv' | 'json') => {
    setExporting(kind)
    try {
      if (kind === 'csv') await api.download('/reports/export.csv', 'saldo-movimenti.csv')
      else await api.download('/reports/export.json', 'saldo-backup.json')
      toast.success('Esportazione completata')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Esportazione non riuscita')
    } finally {
      setExporting(null)
    }
  }

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-24 rounded-3xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    )
  }

  if (summaryQuery.isError || !summary || !current || !comparison) {
    return (
      <div className="card card-pad mx-auto mt-10 max-w-md text-center">
        <h2 className="text-lg font-bold text-ink">Statistiche non disponibili</h2>
        <p className="mt-2 text-sm text-muted">Riprova a caricare i dati tra un istante.</p>
        <Button className="mt-4" onClick={() => summaryQuery.refetch()}>
          Riprova
        </Button>
      </div>
    )
  }

  const incomeChange = pctChange(current.income, comparison.income)
  const expenseChange = pctChange(current.expense, comparison.expense)
  const netChange = pctChange(current.net, comparison.net)
  const savingsChange = Math.round((current.savings_rate - comparison.savings_rate) * 10) / 10
  const topCategories = (categories?.items ?? []).slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analisi"
        title="Statistiche"
        subtitle="Una lettura completa di dove vanno i soldi, chi li riceve e come cambiano le tue abitudini."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              loading={exporting === 'csv'}
              onClick={() => handleExport('csv')}
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileJson className="h-4 w-4" />}
              loading={exporting === 'json'}
              onClick={() => handleExport('json')}
            >
              Backup
            </Button>
          </>
        }
      />

      <div className="card p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => applyPreset(item.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[11.5px] font-medium transition',
                preset === item.value
                  ? 'bg-accent-soft text-accent-ink'
                  : 'text-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <div>
            <label htmlFor="stats-from" className="mb-1 block text-[10px] font-medium text-muted">
              Da
            </label>
            <Input
              id="stats-from"
              type="date"
              value={range.from}
              max={range.to}
              onChange={(event) => {
                setPreset('custom')
                setRange((prev) => ({ ...prev, from: event.target.value }))
              }}
              className="h-9 w-[145px] text-[12px]"
            />
          </div>
          <div>
            <label htmlFor="stats-to" className="mb-1 block text-[10px] font-medium text-muted">
              A
            </label>
            <Input
              id="stats-to"
              type="date"
              value={range.to}
              min={range.from}
              onChange={(event) => {
                setPreset('custom')
                setRange((prev) => ({ ...prev, to: event.target.value }))
              }}
              className="h-9 w-[145px] text-[12px]"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-muted">Confronta con</span>
            <SegmentedControl
              options={[
                { value: 'previous', label: 'Periodo precedente' },
                { value: 'year', label: 'Anno precedente' },
              ]}
              value={comparisonMode}
              onChange={setComparisonMode}
              size="sm"
            />
          </div>
        </div>
      </div>

      <div className="no-scrollbar -mx-1 overflow-x-auto">
        <div className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setTab(item.value)
                if (item.value === 'overview') setCategoryType('expense')
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[12px] font-medium transition',
                tab === item.value ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Entrate"
              value={formatCurrency(current.income)}
              icon={ArrowDownLeft}
              delta={incomeChange}
              positiveIsGood
              hint={`vs ${comparisonLabel}`}
            />
            <StatCard
              label="Uscite"
              value={formatCurrency(current.expense)}
              icon={ArrowUpRight}
              delta={expenseChange}
              positiveIsGood={false}
              hint={`vs ${comparisonLabel}`}
            />
            <StatCard
              label="Saldo del periodo"
              value={formatCurrency(current.net)}
              icon={Wallet}
              delta={netChange}
              positiveIsGood
              hint={`vs ${comparisonLabel}`}
            />
            <StatCard
              label="Tasso di risparmio"
              value={formatPercent(current.savings_rate)}
              icon={PiggyBank}
              hint={`${savingsChange >= 0 ? '+' : ''}${savingsChange.toLocaleString('it-IT')} pp vs ${comparisonLabel}`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailStat
              label="Spesa media"
              value={formatCurrency(current.avg_expense)}
              hint={`${current.expense_count} movimenti`}
            />
            <DetailStat
              label="Spesa giornaliera"
              value={formatCurrency(current.daily_average)}
              hint={`${current.active_days} giorni attivi`}
            />
            <DetailStat
              label="Spese ricorrenti"
              value={formatPercent(current.recurring_share, 0)}
              hint={formatCurrency(current.recurring_expense)}
            />
            <DetailStat
              label="Spesa più alta"
              value={current.largest_expense ? formatCurrency(current.largest_expense.amount) : '—'}
              hint={current.largest_expense?.description ?? 'Nessuna spesa'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <section className="card card-pad xl:col-span-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">Andamento del patrimonio</h2>
                  <p className="mt-0.5 text-xs text-muted">Saldo dei conti negli ultimi 12 mesi</p>
                </div>
                <p className="num text-[15px] font-bold text-ink">
                  {formatCurrency(trendQuery.data?.net_worth.at(-1)?.value ?? 0)}
                </p>
              </div>
              <div className="mt-4">
                <NetWorthChart data={trendQuery.data?.net_worth ?? []} height={260} />
              </div>
            </section>

            <section className="card card-pad xl:col-span-5">
              <h2 className="text-[15px] font-bold text-ink">Entrate e uscite</h2>
              <p className="mt-0.5 text-xs text-muted">{shortRangeLabel(range.from, range.to)}</p>
              <div className="mt-3">
                <MonthlyBars data={summary.series} height={250} />
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <section className="card card-pad xl:col-span-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">Categorie principali</h2>
                  <p className="mt-0.5 text-xs text-muted">Dove si concentrano le uscite</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('categories')}
                  className="text-xs font-semibold text-accent-ink hover:underline"
                >
                  Dettaglio
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {topCategories.map((category) => (
                  <div key={category.name}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                        <span className="truncate">{category.name}</span>
                      </span>
                      <span className="num shrink-0 text-[11.5px] font-semibold text-ink">
                        {formatCurrency(category.amount)}
                      </span>
                    </div>
                    <Progress value={category.percentage} size="sm" />
                  </div>
                ))}
                {topCategories.length === 0 ? (
                  <EmptyState icon={CalendarDays} title="Nessuna spesa" compact />
                ) : null}
              </div>
            </section>

            <section className="card card-pad xl:col-span-5">
              <h2 className="text-[15px] font-bold text-ink">In sintesi</h2>
              <p className="mt-0.5 text-xs text-muted">Indicatori del periodo</p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[12px] text-muted">
                    <Repeat2 className="h-3.5 w-3.5" /> Spese ricorrenti
                  </span>
                  <span className="num text-[12px] font-semibold text-ink">
                    {formatCurrency(current.recurring_expense)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[12px] text-muted">
                    <Users className="h-3.5 w-3.5" /> Beneficiari attivi
                  </span>
                  <span className="num text-[12px] font-semibold text-ink">
                    {payees?.items.filter((item) => item.payee_id !== null).length ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[12px] text-muted">
                    <CalendarDays className="h-3.5 w-3.5" /> Giorni con spese
                  </span>
                  <span className="num text-[12px] font-semibold text-ink">{current.active_days}</span>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-accent/20 bg-accent-soft px-3 py-2.5">
                <p className="text-[11.5px] leading-relaxed text-accent-ink">
                  {current.savings_rate >= 20
                    ? 'Stai risparmiando almeno il 20% delle entrate: buon ritmo.'
                    : current.savings_rate >= 0
                      ? 'Il saldo è positivo, ma c’è margine per aumentare il risparmio.'
                      : 'In questo periodo le uscite superano le entrate.'}
                </p>
              </div>
            </section>
          </div>
        </>
      ) : null}

      {tab === 'categories' ? (
        <section className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-ink">Analisi per categoria</h2>
              <p className="mt-0.5 text-xs text-muted">{shortRangeLabel(range.from, range.to)}</p>
            </div>
            <SegmentedControl
              options={[
                { value: 'expense', label: 'Uscite' },
                { value: 'income', label: 'Entrate' },
              ]}
              value={categoryType}
              onChange={setCategoryType}
              size="sm"
            />
          </div>

          {categoriesQuery.isLoading ? (
            <Skeleton className="mt-5 h-64 rounded-2xl" />
          ) : categories && categories.items.length > 0 ? (
            <div className="mt-5 grid gap-6 xl:grid-cols-12">
              <div className="xl:col-span-5">
                <CategoryDonut
                  data={categories.items}
                  total={categories.total}
                  label={categoryType === 'expense' ? 'Uscite' : 'Entrate'}
                  height={260}
                />
              </div>
              <div className="xl:col-span-7">
                <div className="space-y-3">
                  {categories.items.map((category) => (
                    <div key={category.name}>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                          style={{ backgroundColor: `${category.color}1c`, color: category.color }}
                        >
                          <AppIcon name={category.icon} className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
                          {category.name}
                        </span>
                        <span className="text-[10.5px] text-muted">{category.count} mov.</span>
                        <span className="num w-24 text-right text-[12px] font-semibold text-ink">
                          {formatCurrency(category.amount)}
                        </span>
                        <span className="num w-12 text-right text-[11px] text-muted">
                          {formatPercent(category.percentage, 0)}
                        </span>
                      </div>
                      <div className="ml-9 mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(category.percentage, 100)}%`, backgroundColor: category.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="Nessun dato per il periodo" compact className="mt-6" />
          )}
        </section>
      ) : null}

      {tab === 'payees' ? (
        <div className="grid gap-4 xl:grid-cols-12">
          <section className="card card-pad xl:col-span-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-ink">Beneficiari</h2>
                <p className="mt-0.5 text-xs text-muted">Dove vanno le tue uscite · {shortRangeLabel(range.from, range.to)}</p>
              </div>
              <span className="num text-[15px] font-bold text-ink">{formatCurrency(payees?.total ?? 0)}</span>
            </div>

            {payeesQuery.isLoading ? (
              <Skeleton className="mt-4 h-72 rounded-2xl" />
            ) : (payees?.items.length ?? 0) > 0 ? (
              <div className="mt-4 space-y-2">
                {payees?.items.map((item) => (
                  <button
                    key={`${item.payee_id ?? 'none'}-${item.name}`}
                    type="button"
                    disabled={item.payee_id === null}
                    onClick={() => item.payee_id !== null && setSelectedPayee(item)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                      item.payee_id !== null ? 'hover:bg-surface-2' : 'cursor-default',
                    )}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                      <Users className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-ink">{item.name}</span>
                        {item.default_category ? (
                          <Badge color={item.default_category.color}>{item.default_category.name}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {item.count} movimenti · media {formatCurrency(item.average)}
                      </p>
                    </div>
                    <div className="hidden w-28 sm:block">
                      <Progress value={item.percentage} size="sm" />
                    </div>
                    <span className="num w-24 text-right text-[12px] font-semibold text-ink">
                      {formatCurrency(item.amount)}
                    </span>
                    {item.payee_id !== null ? <ChevronRight className="h-4 w-4 text-muted" /> : null}
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} title="Nessun beneficiario nel periodo" compact className="mt-6" />
            )}
          </section>

          <div className="space-y-4 xl:col-span-4">
            <div className="card card-pad">
              <h2 className="text-[15px] font-bold text-ink">Concentrazione</h2>
              <p className="mt-0.5 text-xs text-muted">Quanto pesano i primi 5 beneficiari</p>
              <p className="num mt-4 font-display text-[32px] font-extrabold tracking-tight text-ink">
                {formatPercent(payees?.top5_share ?? 0, 0)}
              </p>
              <Progress value={payees?.top5_share ?? 0} className="mt-3" />
              <p className="mt-2 text-[11px] text-muted">
                del totale delle uscite del periodo
              </p>
            </div>
            <div className="card card-pad">
              <h3 className="text-[13px] font-bold text-ink">Senza beneficiario</h3>
              <p className="num mt-2 text-[22px] font-bold text-ink">
                {formatCurrency(payees?.unassigned_amount ?? 0)}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                Spese non ancora associate a una controparte. Puoi assegnarle modificando i movimenti.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'accounts' ? (
        <div className="space-y-4">
          <section className="card card-pad">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-ink">Conti e flussi</h2>
                <p className="mt-0.5 text-xs text-muted">{shortRangeLabel(range.from, range.to)}</p>
              </div>
              <div className="text-right">
                <p className="label">Patrimonio attivo</p>
                <p className="num mt-1 text-xl font-bold text-ink">
                  {formatCurrency(accounts?.total_balance ?? 0)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {accounts?.accounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-line p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: account.color }} />
                    <p className="flex-1 truncate text-[13px] font-semibold text-ink">{account.name}</p>
                    <span className="num text-[12px] font-bold text-ink">
                      {formatCurrency(account.balance)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
                    <span className="text-muted">Entrate <span className="num text-ink">{formatCurrency(account.income)}</span></span>
                    <span className="text-muted">Uscite <span className="num text-ink">{formatCurrency(account.expense)}</span></span>
                    <span className="text-muted">Entrate da giri <span className="num text-ink">{formatCurrency(account.transfer_in)}</span></span>
                    <span className="text-muted">Uscite per giri <span className="num text-ink">{formatCurrency(account.transfer_out)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="text-[15px] font-bold text-ink">Matrice trasferimenti</h2>
            <p className="mt-0.5 text-xs text-muted">Soldi spostati tra i tuoi conti nel periodo</p>
            {(accounts?.transfers.length ?? 0) === 0 ? (
              <EmptyState icon={Repeat2} title="Nessun trasferimento" compact className="mt-4" />
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                      <th className="py-2 font-semibold">Da</th>
                      <th className="py-2 font-semibold">A</th>
                      <th className="py-2 text-right font-semibold">Importo</th>
                      <th className="py-2 text-right font-semibold">Movimenti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {accounts?.transfers.map((cell) => (
                      <tr key={`${cell.from_account_id}-${cell.to_account_id}`}>
                        <td className="py-2.5 text-ink">{cell.from_account_name}</td>
                        <td className="py-2.5 text-ink">{cell.to_account_name}</td>
                        <td className="num py-2.5 text-right font-semibold text-ink">{formatCurrency(cell.amount)}</td>
                        <td className="num py-2.5 text-right text-muted">{cell.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'budgets' ? (
        <div className="grid gap-4 xl:grid-cols-12">
          <section className="card card-pad xl:col-span-7">
            <h2 className="text-[15px] font-bold text-ink">Budget vs effettivo</h2>
            <p className="mt-0.5 text-xs text-muted">Ultimi 6 mesi</p>
            <div className="mt-4">
              <BudgetHistoryChart data={budgets?.months ?? []} height={280} />
            </div>
          </section>
          <section className="card card-pad xl:col-span-5">
            <h2 className="text-[15px] font-bold text-ink">Aderenza</h2>
            <p className="mt-0.5 text-xs text-muted">Percentuale del budget utilizzata</p>
            <div className="mt-3 divide-y divide-line">
              {budgets?.months.map((month) => (
                <div key={month.month} className="flex items-center gap-3 py-2.5">
                  <span className="w-20 text-[11px] text-muted">{month.label}</span>
                  <Progress value={month.adherence} size="sm" className="flex-1" />
                  <span
                    className={cn(
                      'num w-12 text-right text-[11px] font-semibold',
                      month.over_count > 0 ? 'text-danger' : 'text-ink',
                    )}
                  >
                    {formatPercent(month.adherence, 0)}
                  </span>
                </div>
              ))}
              {(budgets?.months.length ?? 0) === 0 ? (
                <EmptyState icon={PiggyBank} title="Nessun budget" compact />
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'calendar' ? (
        <div className="space-y-4">
          <section className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-ink">Calendario delle spese</h2>
                <p className="mt-0.5 text-xs text-muted">{shortRangeLabel(range.from, range.to)}</p>
              </div>
              <div className="text-right">
                <p className="label">Totale</p>
                <p className="num mt-1 text-[15px] font-bold text-ink">{formatCurrency(calendar?.total ?? 0)}</p>
              </div>
            </div>
            <div className="mt-5">
              {calendar ? <CalendarHeatmap data={calendar} /> : <Skeleton className="h-24 w-full" />}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-muted">
              <span>Meno</span>
              {[0.15, 0.35, 0.6, 1].map((level) => (
                <span
                  key={level}
                  className="h-3 w-3 rounded-[3px]"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(level * 100)}%, var(--surface-2))`,
                  }}
                />
              ))}
              <span>Più</span>
              <span className="ml-auto">{calendar?.active_days ?? 0} giorni con spese</span>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-12">
            <section className="card card-pad xl:col-span-7">
              <h2 className="text-[15px] font-bold text-ink">Spese per giorno della settimana</h2>
              <p className="mt-0.5 text-xs text-muted">Dove si concentrano le uscite</p>
              <div className="mt-4">
                <WeekdayChart data={calendar?.weekday ?? []} height={230} />
              </div>
            </section>
            <section className="card card-pad xl:col-span-5">
              <h2 className="text-[15px] font-bold text-ink">Giorni più costosi</h2>
              <div className="mt-3 space-y-2">
                {[...(calendar?.daily ?? [])]
                  .filter((day) => day.amount > 0)
                  .sort((a, b) => b.amount - a.amount)
                  .slice(0, 6)
                  .map((day) => (
                    <div key={day.date} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="text-muted">{formatDate(day.date)}</span>
                      <span className="text-[10px] text-muted">{day.count} mov.</span>
                      <span className="num font-semibold text-ink">{formatCurrency(day.amount)}</span>
                    </div>
                  ))}
                {(calendar?.daily.filter((day) => day.amount > 0).length ?? 0) === 0 ? (
                  <p className="text-xs text-muted">Nessuna spesa nel periodo.</p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'forecast' ? (
        <div className="grid gap-4 xl:grid-cols-12">
          <section className="card card-pad xl:col-span-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-ink">Previsione di cassa</h2>
                <p className="mt-0.5 text-xs text-muted">Prossimi 3 mesi</p>
              </div>
              <div className="text-right">
                <p className="label">Saldo stimato</p>
                <p className="num mt-1 text-[15px] font-bold text-ink">
                  {formatCurrency(cashflow?.projected_end_balance ?? 0)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <ForecastChart data={cashflow?.forecast ?? []} height={260} />
            </div>
          </section>
          <section className="card card-pad xl:col-span-5">
            <h2 className="text-[15px] font-bold text-ink">Prossimi mesi</h2>
            <div className="mt-3 space-y-2">
              {cashflow?.forecast.map((month) => (
                <div key={month.month} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
                  <span className="text-[12px] text-muted">{month.label}</span>
                  <span
                    className={cn(
                      'num text-[12px] font-semibold',
                      month.net >= 0 ? 'text-accent' : 'text-danger',
                    )}
                  >
                    {formatCurrency(month.net, { sign: true })}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              La previsione considera solo i movimenti ricorrenti attivi. Le spese una tantum non sono incluse.
            </p>
          </section>
        </div>
      ) : null}

      <PayeeDetailModal payee={selectedPayee} range={range} onClose={() => setSelectedPayee(null)} />
    </div>
  )
}
