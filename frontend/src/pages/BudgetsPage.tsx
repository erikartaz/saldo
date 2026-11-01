import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Copy,
  PieChart,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
} from 'lucide-react'
import { api } from '../lib/api'
import type { BudgetItem, BudgetSummary, Category } from '../types'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatPercent } from '../lib/format'
import { cn, currentMonth, monthLabel, parseAmount, shiftMonth } from '../lib/utils'
import { AppIcon } from '../lib/icons'
import { Button, IconButton } from '../components/ui/Button'
import { Field, FormError, Input, Select } from '../components/ui/Field'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import {
  Badge,
  EmptyState,
  MonthPicker,
  PageHeader,
  Progress,
  Skeleton,
} from '../components/ui/Primitives'

interface BudgetModalProps {
  open: boolean
  onClose: () => void
  month: string
  categories: Category[]
  items: BudgetItem[]
  editing: BudgetItem | null
}

function BudgetModal({ open, onClose, month, categories, items, editing }: BudgetModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const usedCategoryIds = new Set(items.map((item) => item.category.id))
  const available = categories.filter(
    (category) =>
      category.type === 'expense' &&
      !category.archived &&
      (!usedCategoryIds.has(category.id) || category.id === editing?.category.id),
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    if (editing) {
      setCategoryId(String(editing.category.id))
      setAmount(String(editing.amount).replace('.', ','))
    } else {
      setCategoryId(available[0] ? String(available[0].id) : '')
      setAmount('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  const mutation = useMutation({
    mutationFn: (payload: { category_id: number; month: string; amount: number }) =>
      api.post<BudgetSummary>('/budgets', payload),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success(editing ? 'Budget aggiornato' : 'Budget creato')
      onClose()
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const selectedCategory = categories.find((category) => String(category.id) === categoryId)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!categoryId) {
      setError('Scegli una categoria di spesa')
      return
    }
    const parsed = parseAmount(amount)
    if (!parsed || parsed <= 0) {
      setError('Inserisci un importo maggiore di zero')
      return
    }
    mutation.mutate({ category_id: Number(categoryId), month, amount: parsed })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Modifica budget' : 'Nuovo budget'}
      description={`Imposta un tetto di spesa per ${monthLabel(month).toLowerCase()}.`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annulla
          </Button>
          <Button type="submit" form="budget-form" loading={mutation.isPending}>
            {editing ? 'Salva' : 'Crea budget'}
          </Button>
        </div>
      }
    >
      <form id="budget-form" onSubmit={handleSubmit} className="space-y-5">
        {error ? <FormError message={error} /> : null}

        {!editing && available.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface-2 p-4 text-center text-[13px] text-muted">
            Tutte le categorie di spesa hanno già un budget per questo mese.
          </div>
        ) : null}

        <Field label="Categoria" htmlFor="budget-category">
          <Select
            id="budget-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={Boolean(editing)}
          >
            <option value="">Scegli una categoria</option>
            {available.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        {selectedCategory ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
            <span
              className="grid h-9 w-9 place-items-center rounded-lg"
              style={{ backgroundColor: `${selectedCategory.color}1c`, color: selectedCategory.color }}
            >
              <AppIcon name={selectedCategory.icon} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink">{selectedCategory.name}</p>
              <p className="text-[11px] text-muted">
                {editing ? `Speso finora: ${formatCurrency(editing.spent)}` : 'Categoria di spesa'}
              </p>
            </div>
          </div>
        ) : null}

        <Field label="Tetto mensile" htmlFor="budget-amount">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
            <Input
              id="budget-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder="0,00"
              inputMode="decimal"
              className="num pl-8 text-lg font-semibold"
              autoFocus
            />
          </div>
        </Field>
      </form>
    </Modal>
  )
}

export function BudgetsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [month, setMonth] = useState(currentMonth)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BudgetItem | null>(null)
  const [deleting, setDeleting] = useState<BudgetItem | null>(null)

  const budgetsQuery = useQuery({
    queryKey: ['budgets', month],
    queryFn: () => api.get<BudgetSummary>('/budgets', { month }),
  })
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  })

  const deleteMutation = useMutation({
    mutationFn: (item: BudgetItem) => api.delete(`/budgets/${item.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Budget eliminato')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const copyMutation = useMutation({
    mutationFn: () => api.post<BudgetSummary>('/budgets/copy', { from_month: shiftMonth(month, -1), to_month: month }),
    onSuccess: (summary) => {
      queryClient.invalidateQueries()
      toast.success(summary.categories_count > 0 ? 'Budget copiati dal mese precedente' : 'Nessun budget da copiare')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const data = budgetsQuery.data
  const categories = categoriesQuery.data ?? []
  const items = data?.items ?? []
  const totalBudget = data?.total_budget ?? 0
  const totalSpent = data?.total_spent ?? 0
  const overall = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
  const availableCategories = categories.filter(
    (category) =>
      category.type === 'expense' && !category.archived && !items.some((item) => item.category.id === category.id),
  )

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (item: BudgetItem) => {
    setEditing(item)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Budget"
        title="Budget mensili"
        subtitle="Un tetto chiaro per ogni categoria: sai in anticipo dove stanno andando i soldi."
        actions={
          <>
            <MonthPicker value={month} onChange={setMonth} />
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Nuovo budget
            </Button>
          </>
        }
      />

      {budgetsQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card lg:col-span-2">
            <EmptyState
              icon={PieChart}
              title={`Nessun budget per ${monthLabel(month).toLowerCase()}`}
              description="Inizia dalle categorie dove spendi di più: alimentari, casa, trasporti. Potrai modificare gli importi in qualsiasi momento."
              action={
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Crea il primo budget
                </Button>
              }
            />
          </div>
          <div className="card card-pad">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-ink">Un consiglio pratico</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Parti dal 50/30/20: metà delle entrate per i bisogni, il 30% per gli sfizi e il 20% per
              risparmi e obiettivi. Saldo ti mostra subito se sei in linea.
            </p>
            {data && data.unbudgeted_spent > 0 ? (
              <div className="mt-4 rounded-xl bg-warning-soft px-3 py-2 text-[11.5px] font-medium text-warning">
                {formatCurrency(data.unbudgeted_spent)} di spese non sono ancora coperte da un budget.
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <section className="card card-pad">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="label">Budget totale · {monthLabel(month)}</p>
                <p className="num mt-2 font-display text-[32px] font-extrabold leading-none tracking-tight text-ink">
                  {formatCurrency(totalBudget)}
                </p>
                <p className="mt-2 text-[12.5px] text-muted">
                  Speso <span className="font-semibold text-ink">{formatCurrency(totalSpent)}</span> ·{' '}
                  {formatPercent(overall)} del totale
                </p>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <p className="label">Rimanente</p>
                  <p
                    className={cn(
                      'num mt-1.5 text-lg font-bold',
                      data && data.total_remaining < 0 ? 'text-danger' : 'text-ink',
                    )}
                  >
                    {formatCurrency(data?.total_remaining ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="label">Categorie</p>
                  <p className="num mt-1.5 text-lg font-bold text-ink">{data?.categories_count ?? 0}</p>
                </div>
                <div>
                  <p className="label">Sforati</p>
                  <p
                    className={cn(
                      'num mt-1.5 text-lg font-bold',
                      data && data.over_budget_count > 0 ? 'text-danger' : 'text-ink',
                    )}
                  >
                    {data?.over_budget_count ?? 0}
                  </p>
                </div>
              </div>
            </div>
            <Progress value={overall} className="mt-5 h-3" />
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="space-y-2.5 xl:col-span-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="card group p-4 transition hover:border-line-strong sm:p-5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                      style={{ backgroundColor: `${item.category.color}1c`, color: item.category.color }}
                    >
                      <AppIcon name={item.category.icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-semibold text-ink">{item.category.name}</p>
                        {item.over_budget ? <Badge variant="danger">Sforato</Badge> : null}
                        {!item.over_budget && item.percentage >= 80 ? (
                          <Badge variant="warning">Quasi al limite</Badge>
                        ) : null}
                      </div>
                      <p className="num mt-0.5 text-[11.5px] text-muted">
                        {formatCurrency(item.spent)} di {formatCurrency(item.amount)} ·{' '}
                        {item.over_budget
                          ? `superato di ${formatCurrency(Math.abs(item.remaining))}`
                          : `${formatCurrency(item.remaining)} disponibili`}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p
                        className={cn(
                          'num text-[15px] font-bold',
                          item.over_budget ? 'text-danger' : 'text-ink',
                        )}
                      >
                        {formatPercent(item.percentage, 0)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <IconButton label="Modifica budget" onClick={() => openEdit(item)}>
                        <Target className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Elimina budget" variant="danger" onClick={() => setDeleting(item)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                  <Progress
                    value={item.percentage}
                    tone={item.over_budget ? 'danger' : 'auto'}
                    className="mt-3"
                    size="sm"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="card card-pad">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-muted">
                  <Copy className="h-5 w-5" />
                </div>
                <h3 className="mt-3.5 text-sm font-bold text-ink">Riparti dal mese scorso</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Copia tutti i budget di {monthLabel(shiftMonth(month, -1)).toLowerCase()} in questo mese,
                  mantenendo gli importi.
                </p>
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  icon={<Copy className="h-4 w-4" />}
                  loading={copyMutation.isPending}
                  onClick={() => copyMutation.mutate()}
                >
                  Copia dal mese precedente
                </Button>
              </div>

              {data && data.unbudgeted_spent > 0 ? (
                <div className="card card-pad border-warning/25">
                  <div className="flex items-center gap-2 text-warning">
                    <TrendingDown className="h-4 w-4" />
                    <p className="text-[12px] font-semibold uppercase tracking-wide">Fuori budget</p>
                  </div>
                  <p className="num mt-2 text-xl font-bold text-ink">
                    {formatCurrency(data.unbudgeted_spent)}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    Spese in categorie senza un budget impostato per questo mese.
                  </p>
                  <Button variant="ghost" size="sm" className="mt-2 px-0" onClick={openCreate}>
                    Aggiungi un budget <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}

              {availableCategories.length > 0 ? (
                <div className="card card-pad">
                  <p className="label">Categorie scoperte</p>
                  <div className="mt-2.5 space-y-1">
                    {availableCategories.slice(0, 5).map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={openCreate}
                        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition hover:bg-surface-2"
                      >
                        <span
                          className="grid h-7 w-7 place-items-center rounded-md"
                          style={{ backgroundColor: `${category.color}18`, color: category.color }}
                        >
                          <AppIcon name={category.icon} className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 truncate text-[12.5px] text-ink">{category.name}</span>
                        <Plus className="h-3.5 w-3.5 text-muted" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      <BudgetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        month={month}
        categories={categories}
        items={items}
        editing={editing}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        title="Eliminare il budget?"
        description={
          deleting
            ? `Il budget di ${formatCurrency(deleting.amount)} per "${deleting.category.name}" verrà rimosso. Le spese restano registrate.`
            : ''
        }
        confirmLabel="Elimina budget"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
