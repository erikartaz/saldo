import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  CircleCheck,
  Clock,
  Pencil,
  Plus,
  Repeat2,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react'
import { api } from '../lib/api'
import type {
  Account,
  Category,
  CategoryType,
  Forecast,
  Frequency,
  Payee,
  Recurring,
  SuggestionItem,
  TransactionType,
} from '../types'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDate } from '../lib/format'
import {
  cn,
  FREQUENCY_LABELS,
  frequencyLabel,
  parseAmount,
  todayISO,
} from '../lib/utils'
import { AppIcon } from '../lib/icons'
import { Button, IconButton } from '../components/ui/Button'
import { Field, FormError, Input, Select, Textarea } from '../components/ui/Field'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { Combobox } from '../components/ui/Combobox'
import { PayeeField } from '../components/PayeeField'
import {
  Badge,
  EmptyState,
  PageHeader,
  SegmentedControl,
  Skeleton,
  StatCard,
  Switch,
  ToggleRow,
} from '../components/ui/Primitives'
import { ForecastChart } from '../components/charts/Charts'

const TYPE_OPTIONS = [
  { value: 'expense' as const, label: 'Spesa', icon: ArrowUpRight },
  { value: 'income' as const, label: 'Entrata', icon: ArrowDownLeft },
  { value: 'transfer' as const, label: 'Trasferimento', icon: ArrowLeftRight },
]

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Giornaliera' },
  { value: 'weekly', label: 'Settimanale' },
  { value: 'monthly', label: 'Mensile' },
  { value: 'yearly', label: 'Annuale' },
]

interface RecurringModalProps {
  open: boolean
  onClose: () => void
  recurring: Recurring | null
}

function RecurringModal({ open, onClose, recurring }: RecurringModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [type, setType] = useState<TransactionType>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [payeeId, setPayeeId] = useState<number | null>(null)
  const [transferAccountId, setTransferAccountId] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [interval, setInterval] = useState('1')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [autoPost, setAutoPost] = useState(false)
  const [active, setActive] = useState(true)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/accounts'),
    enabled: open,
  })
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    enabled: open,
  })
  const suggestionsQuery = useQuery({
    queryKey: ['description-suggestions', type],
    queryFn: () =>
      api.get<{ items: SuggestionItem[] }>('/suggestions/descriptions', { type, limit: 20 }),
    enabled: open,
  })
  const suggestionOptions = (suggestionsQuery.data?.items ?? []).map((item) => ({
    value: item.value,
    label: item.value,
    hint: item.category_name ?? undefined,
  }))
  const accounts = (accountsQuery.data ?? []).filter(
    (account) => !account.archived || account.id === recurring?.account_id,
  )
  const categories = categoriesQuery.data ?? []

  useEffect(() => {
    if (!open) return
    setError(null)
    if (recurring) {
      setType(recurring.type)
      setDescription(recurring.description)
      setAmount(String(recurring.amount).replace('.', ','))
      setAccountId(String(recurring.account_id))
      setCategoryId(recurring.category_id ? String(recurring.category_id) : '')
      setPayeeId(recurring.payee_id)
      setTransferAccountId(recurring.transfer_account_id ? String(recurring.transfer_account_id) : '')
      setFrequency(recurring.frequency)
      setInterval(String(recurring.interval))
      setStartDate(recurring.start_date)
      setEndDate(recurring.end_date ?? '')
      setAutoPost(recurring.auto_post)
      setActive(recurring.active)
      setNotes(recurring.notes ?? '')
    } else {
      setType('expense')
      setDescription('')
      setAmount('')
      setAccountId('')
      setCategoryId('')
      setPayeeId(null)
      setTransferAccountId('')
      setFrequency('monthly')
      setInterval('1')
      setStartDate(todayISO())
      setEndDate('')
      setAutoPost(false)
      setActive(true)
      setNotes('')
    }
  }, [open, recurring])

  useEffect(() => {
    if (!open || accountId || accounts.length === 0) return
    setAccountId(String(accounts[0].id))
  }, [open, accountId, accounts])

  const visibleCategories = categories.filter(
    (category) =>
      category.type === (type as CategoryType) &&
      (!category.archived || category.id === recurring?.category_id),
  )
  const destinations = accounts.filter((account) => String(account.id) !== accountId)

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      recurring
        ? api.patch<Recurring>(`/recurring/${recurring.id}`, payload)
        : api.post<Recurring>('/recurring', payload),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success(recurring ? 'Ricorrenza aggiornata' : 'Ricorrenza creata')
      onClose()
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const handlePayeeSelected = (payee: Payee | null) => {
    if (!payee?.default_category) return
    if (payee.default_category.type !== type) return
    if (!categoryId) setCategoryId(String(payee.default_category.id))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!description.trim()) {
      setError('Aggiungi una descrizione')
      return
    }
    const parsed = parseAmount(amount)
    if (!parsed || parsed <= 0) {
      setError('Inserisci un importo maggiore di zero')
      return
    }
    if (!accountId) {
      setError('Seleziona il conto')
      return
    }
    if (type === 'transfer') {
      if (!transferAccountId || transferAccountId === accountId) {
        setError('Scegli un conto di destinazione diverso')
        return
      }
    }
    if (endDate && endDate < startDate) {
      setError('La data di fine deve essere successiva alla data di inizio')
      return
    }
    mutation.mutate({
      type,
      amount: parsed,
      description: description.trim(),
      account_id: Number(accountId),
      category_id: type === 'transfer' || !categoryId ? null : Number(categoryId),
      payee_id: type === 'transfer' || payeeId === null ? null : payeeId,
      transfer_account_id: type === 'transfer' ? Number(transferAccountId) : null,
      frequency,
      interval: Math.max(1, Number(interval) || 1),
      start_date: startDate,
      end_date: endDate || null,
      auto_post: autoPost,
      active,
      notes: notes.trim() ? notes.trim() : null,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={recurring ? 'Modifica ricorrenza' : 'Nuova ricorrenza'}
      description="Stipendio, affitto, abbonamenti: Saldo li tiene pronti per il futuro."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annulla
          </Button>
          <Button type="submit" form="recurring-form" loading={mutation.isPending}>
            {recurring ? 'Salva modifiche' : 'Crea ricorrenza'}
          </Button>
        </div>
      }
    >
      <form id="recurring-form" onSubmit={handleSubmit} className="space-y-5">
        {error ? <FormError message={error} /> : null}

        <SegmentedControl
          options={TYPE_OPTIONS}
          value={type}
          onChange={(value) => {
            setType(value)
            if (value === 'transfer') {
              setCategoryId('')
              setPayeeId(null)
            } else {
              setTransferAccountId('')
            }
          }}
          fullWidth
        />

        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Descrizione" htmlFor="rec-description">
            <Combobox
              id="rec-description"
              value={description}
              onChange={setDescription}
              onSelect={(option) => setDescription(option.label)}
              options={suggestionOptions}
              placeholder="Es. Affitto, Netflix, Stipendio…"
              loading={suggestionsQuery.isLoading}
              emptyText="Scrivi una nuova descrizione"
            />
          </Field>
          <Field label="Importo" htmlFor="rec-amount">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
              <Input
                id="rec-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0,00"
                inputMode="decimal"
                className="num pl-8 text-right font-semibold"
              />
            </div>
          </Field>
        </div>

        {type !== 'transfer' ? (
          <Field
            label={type === 'income' ? 'Pagatore' : 'Beneficiario'}
            htmlFor="rec-payee"
            hint="Facoltativo. Scrivi un nome e scegli «Crea beneficiario» per aggiungerlo."
          >
            <PayeeField
              key={`${type}-${recurring?.id ?? 'new'}`}
              id="rec-payee"
              value={payeeId}
              onChange={setPayeeId}
              onPayeeSelected={handlePayeeSelected}
              type={type}
            />
          </Field>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={type === 'transfer' ? 'Dal conto' : 'Conto'} htmlFor="rec-account">
            <Select id="rec-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Seleziona conto</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
          {type !== 'transfer' ? (
            <Field label="Categoria" htmlFor="rec-category">
              <Select id="rec-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Senza categoria</option>
                {visibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Al conto" htmlFor="rec-destination">
              <Select
                id="rec-destination"
                value={transferAccountId}
                onChange={(event) => setTransferAccountId(event.target.value)}
              >
                <option value="">Seleziona destinazione</option>
                {destinations.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Frequenza" htmlFor="rec-frequency">
            <Select
              id="rec-frequency"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as Frequency)}
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ogni" htmlFor="rec-interval">
            <Input
              id="rec-interval"
              type="number"
              min={1}
              max={60}
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
              className="num"
            />
          </Field>
          <div className="flex items-end pb-2.5">
            <p className="text-[11.5px] leading-snug text-muted">
              {frequencyLabel(frequency, Math.max(1, Number(interval) || 1))}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data di inizio" htmlFor="rec-start">
            <Input
              id="rec-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </Field>
          <Field label="Data di fine" htmlFor="rec-end" hint="Facoltativa">
            <Input
              id="rec-end"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Note" htmlFor="rec-notes" hint="Facoltative">
          <Textarea
            id="rec-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="min-h-20"
            maxLength={2000}
          />
        </Field>

        <div className="space-y-2">
          <ToggleRow
            checked={autoPost}
            onChange={setAutoPost}
            label="Registra automaticamente"
            description="Alla scadenza il movimento viene creato senza interventi."
          />
          <ToggleRow
            checked={active}
            onChange={setActive}
            label="Ricorrenza attiva"
            description="Le ricorrenze sospese non entrano nelle previsioni."
          />
        </div>
      </form>
    </Modal>
  )
}

export function RecurringPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Recurring | null>(null)
  const [deleting, setDeleting] = useState<Recurring | null>(null)

  const recurringQuery = useQuery({
    queryKey: ['recurring'],
    queryFn: () => api.get<Recurring[]>('/recurring'),
  })
  const forecastQuery = useQuery({
    queryKey: ['recurring-forecast', 3],
    queryFn: () => api.get<Forecast>('/recurring/forecast', { months: 3 }),
  })

  const invalidate = () => queryClient.invalidateQueries()

  const postDueMutation = useMutation({
    mutationFn: () => api.post<{ created: number }>('/recurring/post-due'),
    onSuccess: (result) => {
      invalidate()
      toast.success(
        result.created > 0
          ? `${result.created} ${result.created === 1 ? 'movimento registrato' : 'movimenti registrati'}`
          : 'Nessuna ricorrenza da registrare',
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const postOneMutation = useMutation({
    mutationFn: (recurring: Recurring) => api.post(`/recurring/${recurring.id}/post`),
    onSuccess: () => {
      invalidate()
      toast.success('Movimento registrato')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const toggleMutation = useMutation({
    mutationFn: (recurring: Recurring) => api.patch(`/recurring/${recurring.id}`, { active: !recurring.active }),
    onSuccess: () => {
      invalidate()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (recurring: Recurring) => api.delete(`/recurring/${recurring.id}`),
    onSuccess: () => {
      invalidate()
      toast.success('Ricorrenza eliminata')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const recurring = recurringQuery.data ?? []
  const forecast = forecastQuery.data
  const active = recurring.filter((item) => item.active)
  const suspended = recurring.filter((item) => !item.active)
  const dueCount = active.filter((item) => item.next_date <= todayISO()).length
  const monthlyExpenses = active
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.monthly_equivalent, 0)
  const monthlyIncome = active
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + item.monthly_equivalent, 0)

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (item: Recurring) => {
    setEditing(item)
    setModalOpen(true)
  }

  const renderRecurring = (item: Recurring) => {
    const nextDate = item.next_date
    const isOverdue = item.active && nextDate < todayISO()
    const isToday = nextDate === todayISO()
    return (
      <div
        key={item.id}
        className={cn(
          'card group p-4 transition hover:border-line-strong',
          !item.active && 'opacity-70',
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{
              backgroundColor: item.category ? `${item.category.color}1c` : 'var(--surface-2)',
              color: item.category?.color ?? 'var(--muted)',
            }}
          >
            {item.category ? (
              <AppIcon name={item.category.icon} className="h-4 w-4" />
            ) : (
              <Repeat2 className="h-4 w-4" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13.5px] font-semibold text-ink">{item.description}</p>
              {item.auto_post ? (
                <Badge variant="success" className="gap-1">
                  <Zap className="h-3 w-3" /> Auto
                </Badge>
              ) : null}
              {isOverdue ? <Badge variant="danger">In ritardo</Badge> : null}
              {isToday ? <Badge variant="warning">Oggi</Badge> : null}
            </div>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {frequencyLabel(item.frequency, item.interval)} · {item.account.name}
              {item.category ? ` · ${item.category.name}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {isOverdue ? `Scaduto il ${formatDate(nextDate)}` : `Prossimo: ${formatDate(nextDate)}`}
              </span>
              {item.end_date ? <span>Fino al {formatDate(item.end_date)}</span> : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <p
              className={cn(
                'num text-[14px] font-bold',
                item.type === 'income' ? 'text-accent' : 'text-ink',
              )}
            >
              {item.type === 'income' ? '+' : item.type === 'expense' ? '−' : ''}
              {formatCurrency(item.amount)}
            </p>
            <p className="text-[10px] text-muted">al mese ≈ {formatCurrency(item.monthly_equivalent, { decimals: 0 })}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={item.active}
              onChange={() => toggleMutation.mutate(item)}
              label={item.active ? 'Sospendi ricorrenza' : 'Riattiva ricorrenza'}
            />
            <span className="text-[11px] text-muted">{item.active ? 'Attiva' : 'Sospesa'}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              icon={<CircleCheck className="h-4 w-4" />}
              onClick={() => postOneMutation.mutate(item)}
              disabled={postOneMutation.isPending || !item.active}
            >
              Registra ora
            </Button>
            <IconButton label="Modifica ricorrenza" onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4" />
            </IconButton>
            <IconButton label="Elimina ricorrenza" variant="danger" onClick={() => setDeleting(item)}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ricorrenti"
        title="Entrate e uscite fisse"
        subtitle="Stipendio, affitto, abbonamenti: pianifica il futuro senza inserire gli stessi movimenti ogni mese."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<CalendarClock className="h-4 w-4" />}
              onClick={() => postDueMutation.mutate()}
              loading={postDueMutation.isPending}
            >
              Registra scaduti
              {dueCount > 0 ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {dueCount}
                </span>
              ) : null}
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Nuova ricorrenza
            </Button>
          </>
        }
      />

      {recurringQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : recurring.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Repeat2}
            title="Nessuna ricorrenza"
            description="Aggiungi lo stipendio, l'affitto o gli abbonamenti: Saldo calcolerà le previsioni dei prossimi mesi e ti avviserà quando è ora di registrarli."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Crea la prima ricorrenza
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Spese fisse / mese"
              value={formatCurrency(monthlyExpenses)}
              icon={ArrowUpRight}
              hint={`${active.filter((item) => item.type === 'expense').length} ricorrenze`}
            />
            <StatCard
              label="Entrate fisse / mese"
              value={formatCurrency(monthlyIncome)}
              icon={ArrowDownLeft}
              hint={`${active.filter((item) => item.type === 'income').length} ricorrenze`}
            />
            <StatCard
              label="Saldo previsto"
              value={formatCurrency(forecast?.projected_end_balance ?? 0)}
              icon={Wallet}
              hint="tra 3 mesi"
            />
            <StatCard
              label="Da registrare"
              value={String(dueCount)}
              icon={CalendarClock}
              hint={dueCount > 0 ? 'scadute e non registrate' : 'tutto in ordine'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className="card card-pad xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">Previsione di cassa</h2>
                  <p className="mt-0.5 text-xs text-muted">Prossimi 3 mesi, solo movimenti ricorrenti</p>
                </div>
                <div className="text-right">
                  <p className="label">Saldo stimato</p>
                  <p className="num mt-1 text-lg font-bold text-ink">
                    {formatCurrency(forecast?.projected_end_balance ?? 0)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <ForecastChart data={forecast?.months ?? []} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                {(forecast?.months ?? []).map((month) => (
                  <div key={month.month} className="rounded-xl bg-surface-2 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{month.label}</p>
                    <p
                      className={cn(
                        'num mt-1 text-[13px] font-bold',
                        month.net >= 0 ? 'text-accent' : 'text-danger',
                      )}
                    >
                      {formatCurrency(month.net, { sign: true })}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="card card-pad">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">In arrivo</h2>
                  <p className="mt-0.5 text-xs text-muted">Prossimi 30 giorni</p>
                </div>
                <Badge variant="neutral">{forecast?.upcoming.length ?? 0}</Badge>
              </div>
              {!forecast || forecast.upcoming.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="Niente in arrivo"
                  description="Nessuna ricorrenza nei prossimi 30 giorni."
                  compact
                />
              ) : (
                <div className="mt-2 divide-y divide-line">
                  {forecast.upcoming.slice(0, 6).map((item) => (
                    <div key={`${item.recurring_id}-${item.date}`} className="flex items-center gap-3 py-2.5">
                      <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-2 text-[10px] font-bold leading-none text-muted">
                        <span className="text-[12px]">{item.date.slice(8, 10)}</span>
                        <span className="mt-0.5 text-[8px] uppercase">
                          {new Date(`${item.date}T00:00:00`).toLocaleDateString('it-IT', { month: 'short' })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-ink">{item.description}</p>
                        <p className="truncate text-[10.5px] text-muted">{item.category_name ?? item.account_name}</p>
                      </div>
                      <span
                        className={cn(
                          'num text-[11.5px] font-semibold',
                          item.type === 'income' ? 'text-accent' : 'text-ink',
                        )}
                      >
                        {item.type === 'income' ? '+' : '−'}
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-ink">Ricorrenze attive</h2>
                <p className="text-xs text-muted">{active.length} in corso</p>
              </div>
            </div>
            <div className="grid gap-2.5">
              {active.map(renderRecurring)}
              {active.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={Repeat2}
                    title="Nessuna ricorrenza attiva"
                    description="Riattiva una ricorrenza sospesa per rivederla qui."
                    compact
                  />
                </div>
              ) : null}
            </div>
          </section>

          {suspended.length > 0 ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-[15px] font-bold text-ink">Sospese</h2>
                <p className="text-xs text-muted">{suspended.length} ricorrenze</p>
              </div>
              <div className="grid gap-2.5">{suspended.map(renderRecurring)}</div>
            </section>
          ) : null}
        </>
      )}

      <RecurringModal open={modalOpen} onClose={() => setModalOpen(false)} recurring={editing} />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        title="Eliminare la ricorrenza?"
        description={
          deleting
            ? `"${deleting.description}" non verrà più generata. I movimenti già registrati restano invariati.`
            : ''
        }
        confirmLabel="Elimina"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
