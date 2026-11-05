import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Flag,
  PiggyBank,
  PieChart,
  Plus,
  Repeat2,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import type { CategorySlice, Dashboard, Goal, Transaction } from '../types'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDateShort, formatPercent, formatSignedAmount } from '../lib/format'
import { cn, monthLabel, todayISO } from '../lib/utils'
import { AppIcon } from '../lib/icons'
import { Button } from '../components/ui/Button'
import {
  Badge,
  EmptyState,
  MonthPicker,
  PageHeader,
  Progress,
  SectionTitle,
  Skeleton,
  StatCard,
} from '../components/ui/Primitives'
import { CashflowChart, CategoryDonut } from '../components/charts/Charts'

function MovementRow({ transaction }: { transaction: Transaction }) {
  const isIncome = transaction.type === 'income'
  const isTransfer = transaction.type === 'transfer'
  const Icon = isIncome ? ArrowDownLeft : isTransfer ? ArrowLeftRight : ArrowUpRight

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/60 sm:px-6">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{
          backgroundColor: transaction.category ? `${transaction.category.color}18` : 'var(--surface-2)',
          color: transaction.category?.color ?? 'var(--muted)',
        }}
      >
        {transaction.category ? (
          <AppIcon name={transaction.category.icon} className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink">{transaction.description}</p>
        <p className="truncate text-[11px] text-muted">
          {transaction.category?.name ?? (isTransfer ? 'Trasferimento' : 'Senza categoria')}
          {transaction.payee ? ` · ${transaction.payee.name}` : ''}
          {transaction.transfer_account ? ` → ${transaction.transfer_account.name}` : ` · ${transaction.account.name}`}
        </p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            'num text-[13px] font-semibold',
            isIncome ? 'text-accent' : isTransfer ? 'text-muted' : 'text-ink',
          )}
        >
          {isTransfer ? formatCurrency(transaction.amount) : formatSignedAmount(transaction.amount, transaction.type)}
        </p>
        <p className="text-[10px] text-muted">{formatDateShort(transaction.date)}</p>
      </div>
    </div>
  )
}

function BudgetPreview({ data }: { data: Dashboard }) {
  const items = data.budgets.items.slice(0, 4)
  return (
    <div className="card card-pad xl:col-span-4">
      <SectionTitle
        title="Budget del mese"
        subtitle={data.budgets.categories_count > 0 ? `${data.budgets.categories_count} categorie` : 'Nessun budget'}
        action={
          <Link to="/budgets" className="text-xs font-semibold text-accent-ink hover:underline">
            Gestisci
          </Link>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="Nessun budget impostato"
          description="Definisci un tetto di spesa per tenere sotto controllo le categorie."
          compact
          action={
            <Link to="/budgets">
              <Button size="sm" variant="secondary">
                Crea budget
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="mt-4 space-y-3.5">
          {items.map((item) => (
            <div key={item.id}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-ink">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.category.color }} />
                  <span className="truncate">{item.category.name}</span>
                </span>
                <span className="num shrink-0 text-[11px] text-muted">
                  {formatCurrency(item.spent)} / {formatCurrency(item.amount, { decimals: 0 })}
                </span>
              </div>
              <Progress value={item.percentage} size="sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GoalsPreview({ goals }: { goals: Goal[] }) {
  return (
    <div className="card card-pad xl:col-span-4">
      <SectionTitle
        title="Obiettivi"
        subtitle="I tuoi prossimi traguardi"
        action={
          <Link to="/goals" className="text-xs font-semibold text-accent-ink hover:underline">
            Tutti
          </Link>
        }
      />
      {goals.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Nessun obiettivo"
          description="Metti da parte per un viaggio, un fondo o un acquisto importante."
          compact
          action={
            <Link to="/goals">
              <Button size="sm" variant="secondary">
                Crea obiettivo
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="mt-4 space-y-4">
          {goals.map((goal) => (
            <div key={goal.id}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-ink">
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
                    style={{ backgroundColor: `${goal.color}18`, color: goal.color }}
                  >
                    <AppIcon name={goal.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{goal.name}</span>
                </span>
                <span className="num shrink-0 text-[11px] font-semibold" style={{ color: goal.color }}>
                  {formatPercent(goal.percentage, 0)}
                </span>
              </div>
              <Progress value={goal.percentage} tone="accent" size="sm" />
              <p className="num mt-1 text-[10.5px] text-muted">
                {formatCurrency(goal.contributed)} di {formatCurrency(goal.target_amount, { decimals: 0 })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UpcomingPreview({ data }: { data: Dashboard }) {
  return (
    <div className="card card-pad xl:col-span-4">
      <SectionTitle
        title="In arrivo"
        subtitle="Prossimi 30 giorni"
        action={
          <Link to="/recurring" className="text-xs font-semibold text-accent-ink hover:underline">
            Dettagli
          </Link>
        }
      />
      {data.upcoming.length === 0 ? (
        <EmptyState
          icon={Repeat2}
          title="Nessuna ricorrenza"
          description="Aggiungi stipendio, affitto o abbonamenti per prevedere il mese."
          compact
          action={
            <Link to="/recurring">
              <Button size="sm" variant="secondary">
                Aggiungi ricorrenza
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="mt-3 divide-y divide-line">
          {data.upcoming.slice(0, 4).map((item) => {
            const overdue = item.date < todayISO()
            return (
              <div key={`${item.recurring_id}-${item.date}`} className="flex items-center gap-3 py-2.5">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-bold leading-none',
                    overdue ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted',
                  )}
                >
                  <span className="text-[13px]">{item.date.slice(8, 10)}</span>
                  <span className="mt-0.5 text-[9px] uppercase">
                    {new Date(`${item.date}T00:00:00`).toLocaleDateString('it-IT', { month: 'short' })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink">{item.description}</p>
                  <p className="truncate text-[10.5px] text-muted">
                    {item.category_name ?? item.account_name}
                  </p>
                </div>
                <span
                  className={cn(
                    'num text-[12px] font-semibold',
                    item.type === 'income' ? 'text-accent' : item.type === 'transfer' ? 'text-muted' : 'text-ink',
                  )}
                >
                  {formatSignedAmount(item.amount, item.type)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Onboarding({ name }: { name: string }) {
  return (
    <div className="space-y-5">
      <div className="hero-card rounded-3xl p-6 sm:p-8">
        <Badge variant="lime" className="bg-white/10 text-[#D9F99D]">
          Iniziamo
        </Badge>
        <h2 className="mt-4 max-w-xl font-display text-[26px] font-extrabold leading-tight tracking-tight text-white sm:text-[32px]">
          Benvenuto in Saldo, {name.split(' ')[0]}.
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/60">
          Tre passaggi per trasformare i numeri in decisioni. In meno di due minuti avrai il tuo
          primo quadro d'insieme.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/accounts">
            <Button variant="lime" icon={<Plus className="h-4 w-4" />}>
              Crea il primo conto
            </Button>
          </Link>
          <Link to="/transactions?new=1">
            <Button variant="secondary" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              Registra un movimento
            </Button>
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { step: '01', title: 'Crea i conti', text: 'Conto corrente, risparmi, contanti o carta.' },
            { step: '02', title: 'Registra i movimenti', text: 'Entrate, spese e trasferimenti tra conti.' },
            { step: '03', title: 'Pianifica', text: 'Budget, ricorrenze e obiettivi di risparmio.' },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
              <span className="font-display text-[11px] font-bold text-[#C8F169]">{item.step}</span>
              <p className="mt-1.5 text-[13px] font-semibold text-white">{item.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: PieChart,
            title: 'Budget mensili',
            text: 'Tetti di spesa per categoria con avanzamento immediato.',
            to: '/budgets',
          },
          {
            icon: Repeat2,
            title: 'Entrate e uscite ricorrenti',
            text: 'Stipendio, affitto e abbonamenti generati in automatico.',
            to: '/recurring',
          },
          {
            icon: Target,
            title: 'Obiettivi di risparmio',
            text: 'Traguardi concreti con versamenti e avanzamento.',
            to: '/goals',
          },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.title} to={item.to} className="card card-pad group transition hover:border-line-strong">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="mt-4 text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{item.text}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink">
                Scopri <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-3xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Skeleton className="h-[360px] rounded-3xl xl:col-span-8" />
        <Skeleton className="h-[360px] rounded-3xl xl:col-span-4" />
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-3xl xl:col-span-4" />
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', month],
    queryFn: () => api.get<Dashboard>('/reports/dashboard', { month }),
  })

  const firstName = user?.name?.split(' ')[0] ?? ''

  if (isLoading) return <DashboardSkeleton />

  if (isError || !data) {
    return (
      <div className="card card-pad mx-auto mt-10 max-w-md text-center">
        <h2 className="text-lg font-bold text-ink">Qualcosa non ha funzionato</h2>
        <p className="mt-2 text-sm text-muted">
          {error instanceof Error ? error.message : 'Non riesco a caricare la dashboard.'}
        </p>
        <Button className="mt-4" onClick={() => refetch()}>
          Riprova
        </Button>
      </div>
    )
  }

  const periodLabel = monthLabel(month)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Panoramica"
        title={firstName ? `Ciao, ${firstName}` : 'La tua situazione'}
        subtitle={`Ecco come stanno andando le tue finanze a ${periodLabel.toLowerCase()}.`}
        actions={
          <>
            <MonthPicker value={month} onChange={setMonth} />
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => navigate('/transactions?new=1')}
              className="hidden sm:inline-flex"
            >
              Aggiungi
            </Button>
          </>
        }
      />

      {data.accounts.length === 0 ? (
        <Onboarding name={firstName || 'amico'} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              featured
              className="col-span-2 sm:col-span-1"
              label="Patrimonio netto"
              value={formatCurrency(data.net_worth)}
              icon={Wallet}
              hint={`${data.accounts.length} conti attivi`}
            />
            <StatCard
              label="Entrate del mese"
              value={formatCurrency(data.month_income)}
              icon={ArrowDownLeft}
              delta={data.income_change}
              positiveIsGood
              hint="vs mese scorso"
            />
            <StatCard
              label="Uscite del mese"
              value={formatCurrency(data.month_expense)}
              icon={ArrowUpRight}
              delta={data.expense_change}
              positiveIsGood={false}
              hint="vs mese scorso"
            />
            <StatCard
              className="col-span-2 sm:col-span-1"
              label="Risparmio del mese"
              value={formatCurrency(data.month_net)}
              icon={PiggyBank}
              hint={`${formatPercent(data.savings_rate)} delle entrate`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <section className="card card-pad xl:col-span-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionTitle title="Flusso di cassa" subtitle="Entrate e uscite degli ultimi 6 mesi" />
                <div className="flex items-center gap-4 text-[11px] font-medium">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="h-2 w-2 rounded-full bg-accent" /> Entrate
                  </span>
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="h-2 w-2 rounded-full bg-[#F97316]" /> Uscite
                  </span>
                  <span className="hidden items-center gap-1 text-ink sm:flex">
                    <TrendingUp className="h-3.5 w-3.5 text-accent" />
                    {formatCurrency(data.month_net, { sign: true })}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <CashflowChart data={data.series} />
              </div>
            </section>

            <section className="card card-pad xl:col-span-4">
              <SectionTitle title="Spese per categoria" subtitle={periodLabel} />
              <CategoryDonut data={data.categories} total={data.month_expense} label="Uscite" />
              {data.categories.length > 0 ? (
                <div className="mt-1 space-y-2">
                  {data.categories.slice(0, 4).map((category: CategorySlice) => (
                    <div key={category.name} className="flex items-center gap-2.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{category.name}</span>
                      <span className="num text-[11.5px] font-semibold text-ink">
                        {formatCurrency(category.amount, { decimals: 0 })}
                      </span>
                      <span className="num w-10 text-right text-[10.5px] text-muted">
                        {formatPercent(category.percentage, 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-muted">Nessuna spesa registrata in questo mese.</p>
              )}
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <BudgetPreview data={data} />
            <GoalsPreview goals={data.goals} />
            <UpcomingPreview data={data} />
          </div>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <SectionTitle title="Movimenti recenti" subtitle="Gli ultimi movimenti registrati" />
              <Link to="/transactions" className="text-xs font-semibold text-accent-ink hover:underline">
                Vedi tutti
              </Link>
            </div>
            {data.recent.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="Ancora nessun movimento"
                description="Registra la prima spesa o entrata per iniziare a vedere i tuoi numeri."
                action={
                  <Button size="sm" onClick={() => navigate('/transactions?new=1')}>
                    Nuovo movimento
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {data.recent.map((transaction) => (
                  <MovementRow key={transaction.id} transaction={transaction} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
