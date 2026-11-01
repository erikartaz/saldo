import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  FileJson,
  PiggyBank,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import type { Cashflow, CategoryReport, CategoryType, Trend } from '../types'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDate, formatPercent } from '../lib/format'
import { cn, monthLabel } from '../lib/utils'
import { AppIcon } from '../lib/icons'
import { Button } from '../components/ui/Button'
import {
  EmptyState,
  PageHeader,
  SegmentedControl,
  Skeleton,
  StatCard,
} from '../components/ui/Primitives'
import { CategoryDonut, CashflowChart, ForecastChart, NetWorthChart } from '../components/charts/Charts'

type CategoryPeriod = 'month' | 'quarter' | 'year'

function categoryRange(period: CategoryPeriod): { from: string; to: string } {
  const now = new Date()
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (period === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to }
  }
  if (period === 'quarter') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    return {
      from: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`,
      to,
    }
  }
  return { from: `${now.getFullYear()}-01-01`, to }
}

export function ReportsPage() {
  const toast = useToast()
  const [trendMonths, setTrendMonths] = useState(12)
  const [categoryPeriod, setCategoryPeriod] = useState<CategoryPeriod>('quarter')
  const [categoryType, setCategoryType] = useState<CategoryType>('expense')
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null)

  const trendQuery = useQuery({
    queryKey: ['reports-trend', trendMonths],
    queryFn: () => api.get<Trend>('/reports/trend', { months: trendMonths }),
  })
  const cashflowQuery = useQuery({
    queryKey: ['reports-cashflow'],
    queryFn: () => api.get<Cashflow>('/reports/cashflow', { history_months: 6, forecast_months: 3 }),
  })
  const range = categoryRange(categoryPeriod)
  const categoriesQuery = useQuery({
    queryKey: ['reports-categories', range.from, range.to, categoryType],
    queryFn: () =>
      api.get<CategoryReport>('/reports/categories', {
        date_from: range.from,
        date_to: range.to,
        type: categoryType,
      }),
  })

  const trend = trendQuery.data
  const cashflow = cashflowQuery.data
  const report = categoriesQuery.data

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

  if (trendQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    )
  }

  if (trendQuery.isError || !trend) {
    return (
      <div className="card card-pad mx-auto mt-10 max-w-md text-center">
        <h2 className="text-lg font-bold text-ink">Report non disponibili</h2>
        <p className="mt-2 text-sm text-muted">Riprova a caricare la pagina tra un istante.</p>
        <Button className="mt-4" onClick={() => trendQuery.refetch()}>
          Riprova
        </Button>
      </div>
    )
  }

  const net = trend.total_income - trend.total_expense
  const periodLabel = trendMonths === 6 ? 'ultimi 6 mesi' : trendMonths === 24 ? 'ultimi 24 mesi' : 'ultimi 12 mesi'
  const bestMonth = [...trend.months].sort((a, b) => b.net - a.net)[0]
  const hasData = trend.total_income !== 0 || trend.total_expense !== 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analisi"
        title="Report e andamenti"
        subtitle="Una lettura più profonda di entrate, uscite, patrimonio e categorie di spesa."
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
              Backup JSON
            </Button>
          </>
        }
      />

      {!hasData ? (
        <div className="card">
          <EmptyState
            icon={Sparkles}
            title="Ancora nessun dato da analizzare"
            description="Registra qualche movimento e torna qui: vedrai l'andamento del patrimonio, la distribuzione delle spese e le previsioni."
            action={
              <Link to="/transactions?new=1">
                <Button>Registra un movimento</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">Periodo analizzato: <span className="font-medium text-ink">{periodLabel}</span></p>
            <SegmentedControl
              options={[
                { value: '6', label: '6 mesi' },
                { value: '12', label: '12 mesi' },
                { value: '24', label: '24 mesi' },
              ]}
              value={String(trendMonths)}
              onChange={(value) => setTrendMonths(Number(value))}
              size="sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Entrate totali"
              value={formatCurrency(trend.total_income)}
              icon={ArrowDownLeft}
              hint={`media ${formatCurrency(trend.average_income)}/mese`}
            />
            <StatCard
              label="Uscite totali"
              value={formatCurrency(trend.total_expense)}
              icon={ArrowUpRight}
              hint={`media ${formatCurrency(trend.average_expense)}/mese`}
            />
            <StatCard
              label="Saldo del periodo"
              value={formatCurrency(net)}
              icon={Wallet}
              hint={net >= 0 ? 'risparmio positivo' : 'spese sopra le entrate'}
            />
            <StatCard
              label="Tasso di risparmio"
              value={formatPercent(trend.savings_rate)}
              icon={PiggyBank}
              hint={bestMonth ? `miglior mese: ${bestMonth.label}` : undefined}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <section className="card card-pad xl:col-span-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">Andamento del patrimonio</h2>
                  <p className="mt-0.5 text-xs text-muted">Saldo cumulato dei conti a fine mese</p>
                </div>
                <div className="text-right">
                  <p className="label">Oggi</p>
                  <p className="num mt-1 text-lg font-bold text-ink">
                    {formatCurrency(trend.net_worth[trend.net_worth.length - 1]?.value ?? 0)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <NetWorthChart data={trend.net_worth} height={280} />
              </div>
            </section>

            <section className="card card-pad xl:col-span-4">
              <h2 className="text-[15px] font-bold text-ink">Il tuo ritmo</h2>
              <p className="mt-0.5 text-xs text-muted">Quanto stai mettendo da parte</p>

              <div className="mt-6 flex items-baseline gap-2">
                <span
                  className={cn(
                    'num font-display text-[40px] font-extrabold leading-none tracking-tight',
                    trend.savings_rate >= 20 ? 'text-accent' : trend.savings_rate >= 0 ? 'text-ink' : 'text-danger',
                  )}
                >
                  {formatPercent(trend.savings_rate)}
                </span>
                <span className="text-xs text-muted">delle entrate</span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
                  <span className="text-[12px] text-muted">Risparmio medio / mese</span>
                  <span className="num text-[12.5px] font-semibold text-ink">
                    {formatCurrency(net / trendMonths)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
                  <span className="text-[12px] text-muted">Miglior mese</span>
                  <span className="text-[12.5px] font-semibold text-ink">{bestMonth?.label ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
                  <span className="text-[12px] text-muted">Patrimonio attuale</span>
                  <span className="num text-[12.5px] font-semibold text-ink">
                    {formatCurrency(trend.net_worth[trend.net_worth.length - 1]?.value ?? 0)}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-xl border border-accent/20 bg-accent-soft px-3 py-2.5">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
                <p className="text-[11.5px] leading-relaxed text-accent-ink">
                  Un buon punto di partenza è risparmiare almeno il 20% delle entrate ogni mese.
                </p>
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <section className="card card-pad xl:col-span-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">Entrate e uscite</h2>
                  <p className="mt-0.5 text-xs text-muted">Confronto mese per mese</p>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="h-2 w-2 rounded-full bg-accent" /> Entrate
                  </span>
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="h-2 w-2 rounded-full bg-[#F97316]" /> Uscite
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <CashflowChart data={trend.months} height={260} />
              </div>
            </section>

            <section className="card card-pad xl:col-span-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">Per categoria</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {report ? `${formatDate(report.date_from)} – ${formatDate(report.date_to)}` : 'Caricamento…'}
                  </p>
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

              <div className="mt-3">
                <SegmentedControl
                  options={[
                    { value: 'month', label: 'Mese' },
                    { value: 'quarter', label: '3 mesi' },
                    { value: 'year', label: 'Anno' },
                  ]}
                  value={categoryPeriod}
                  onChange={setCategoryPeriod}
                  size="sm"
                  fullWidth
                />
              </div>

              {categoriesQuery.isLoading ? (
                <Skeleton className="mt-4 h-56 rounded-2xl" />
              ) : (
                <>
                  <CategoryDonut
                    data={report?.items ?? []}
                    total={report?.total ?? 0}
                    height={210}
                    label={categoryType === 'expense' ? 'Uscite' : 'Entrate'}
                  />
                  <div className="mt-1 space-y-1.5">
                    {(report?.items ?? []).slice(0, 5).map((item) => (
                      <div key={item.name} className="flex items-center gap-2.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{item.name}</span>
                        <span className="num text-[11.5px] font-semibold text-ink">{formatCurrency(item.amount)}</span>
                        <span className="num w-10 text-right text-[10.5px] text-muted">
                          {formatPercent(item.percentage, 0)}
                        </span>
                      </div>
                    ))}
                    {(report?.items.length ?? 0) === 0 ? (
                      <p className="py-3 text-center text-xs text-muted">Nessun movimento nel periodo.</p>
                    ) : null}
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <section className="card card-pad xl:col-span-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">Dettaglio categorie</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {report?.transaction_count ?? 0} movimenti · media{' '}
                    {formatCurrency(report?.average_transaction ?? 0)}
                  </p>
                </div>
                <span className="num text-sm font-bold text-ink">{formatCurrency(report?.total ?? 0)}</span>
              </div>

              <div className="mt-4 space-y-3">
                {(report?.items ?? []).map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                        style={{ backgroundColor: `${item.color}1c`, color: item.color }}
                      >
                        <AppIcon name={item.icon} className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{item.name}</span>
                      <span className="text-[10.5px] text-muted">{item.count} mov.</span>
                      <span className="num w-24 text-right text-[12px] font-semibold text-ink">
                        {formatCurrency(item.amount)}
                      </span>
                      <span className="num w-12 text-right text-[11px] text-muted">
                        {formatPercent(item.percentage, 0)}
                      </span>
                    </div>
                    <div className="ml-9 mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(item.percentage, 100)}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
                {(report?.items.length ?? 0) === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">Nessun dato per il periodo selezionato.</p>
                ) : null}
              </div>
            </section>

            <section className="card card-pad xl:col-span-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">Previsione di cassa</h2>
                  <p className="mt-0.5 text-xs text-muted">Prossimi 3 mesi</p>
                </div>
                <div className="text-right">
                  <p className="label">Stimato</p>
                  <p className="num mt-1 text-[15px] font-bold text-ink">
                    {formatCurrency(cashflow?.projected_end_balance ?? 0)}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <ForecastChart data={cashflow?.forecast ?? []} height={200} />
              </div>

              <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-muted">Saldo attuale</span>
                  <span className="num font-semibold text-ink">{formatCurrency(cashflow?.starting_balance ?? 0)}</span>
                </div>
                {(cashflow?.forecast ?? []).map((month) => (
                  <div key={month.month} className="flex items-center justify-between text-[11.5px]">
                    <span className="text-muted">{monthLabel(month.month)}</span>
                    <span className={cn('num font-semibold', month.net >= 0 ? 'text-accent' : 'text-danger')}>
                      {formatCurrency(month.net, { sign: true })}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                to="/recurring"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink hover:underline"
              >
                Gestisci le ricorrenze <ArrowUpRight className="h-3 w-3" />
              </Link>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
