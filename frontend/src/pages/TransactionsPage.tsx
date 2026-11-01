import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import type { Account, Category, Transaction, TransactionPage, TransactionType } from '../types'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDate, formatPercent, formatSignedAmount, relativeDay } from '../lib/format'
import { cn, todayISO } from '../lib/utils'
import { AppIcon } from '../lib/icons'
import { Button, IconButton } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Field'
import { ConfirmDialog } from '../components/ui/Modal'
import {
  EmptyState,
  PageHeader,
  SegmentedControl,
  Skeleton,
  StatCard,
} from '../components/ui/Primitives'
import { TransactionModal } from '../components/TransactionModal'

type TypeFilter = 'all' | TransactionType

const TYPE_OPTIONS = [
  { value: 'all' as const, label: 'Tutti' },
  { value: 'expense' as const, label: 'Uscite' },
  { value: 'income' as const, label: 'Entrate' },
  { value: 'transfer' as const, label: 'Giroconti' },
]

function TypeIcon({ type, className }: { type: TransactionType; className?: string }) {
  if (type === 'income') return <ArrowDownLeft className={className} />
  if (type === 'transfer') return <ArrowLeftRight className={className} />
  return <ArrowUpRight className={className} />
}

function Amount({ transaction }: { transaction: Transaction }) {
  if (transaction.type === 'transfer') {
    return <span className="num font-semibold text-muted">{formatCurrency(transaction.amount)}</span>
  }
  return (
    <span
      className={cn(
        'num font-semibold',
        transaction.type === 'income' ? 'text-accent' : 'text-ink',
      )}
    >
      {formatSignedAmount(transaction.amount, transaction.type)}
    </span>
  )
}

function RowActions({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton label="Modifica movimento" onClick={() => onEdit(transaction)}>
        <Pencil className="h-4 w-4" />
      </IconButton>
      <IconButton label="Elimina movimento" variant="danger" onClick={() => onDelete(transaction)}>
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </div>
  )
}

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [accountFilter, setAccountFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, typeFilter, accountFilter, categoryFilter, dateFrom, dateTo])

  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    setEditing(null)
    setModalOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/accounts'),
  })
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  })

  const transactionsQuery = useQuery({
    queryKey: ['transactions', debouncedQ, typeFilter, accountFilter, categoryFilter, dateFrom, dateTo, page],
    queryFn: () =>
      api.get<TransactionPage>('/transactions', {
        q: debouncedQ || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
        account_id: accountFilter || undefined,
        category_id: categoryFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        page_size: 25,
      }),
    placeholderData: keepPreviousData,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Movimento eliminato')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const accounts = accountsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const data = transactionsQuery.data
  const items = data?.items ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  const activeFilters =
    (debouncedQ ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (accountFilter ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  const resetFilters = () => {
    setQ('')
    setTypeFilter('all')
    setAccountFilter('')
    setCategoryFilter('')
    setDateFrom('')
    setDateTo('')
  }

  const groups = useMemo(() => {
    const result: { date: string; items: Transaction[] }[] = []
    for (const transaction of items) {
      const last = result[result.length - 1]
      if (last && last.date === transaction.date) last.items.push(transaction)
      else result.push({ date: transaction.date, items: [transaction] })
    }
    return result
  }, [items])

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (transaction: Transaction) => {
    setEditing(transaction)
    setModalOpen(true)
  }

  const defaultType: TransactionType =
    typeFilter === 'expense' || typeFilter === 'income' || typeFilter === 'transfer' ? typeFilter : 'expense'

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Movimenti"
        title="Tutte le operazioni"
        subtitle="Cerca, filtra e tieni sotto controllo ogni entrata, spesa e trasferimento."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nuovo movimento
          </Button>
        }
      />

      <div className="card grid grid-cols-3 divide-x divide-line p-3 sm:hidden">
        <div className="px-2 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Entrate</p>
          <p className="num mt-1 break-words text-[12px] font-bold text-accent">
            {formatCurrency(data?.totals.income ?? 0)}
          </p>
        </div>
        <div className="px-2 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Uscite</p>
          <p className="num mt-1 break-words text-[12px] font-bold text-ink">
            {formatCurrency(data?.totals.expense ?? 0)}
          </p>
        </div>
        <div className="px-2 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Saldo</p>
          <p className="num mt-1 break-words text-[12px] font-bold text-ink">
            {formatCurrency(data?.totals.net ?? 0)}
          </p>
        </div>
      </div>

      <div className="hidden gap-3 sm:grid sm:grid-cols-3">
        <StatCard
          label="Entrate"
          value={formatCurrency(data?.totals.income ?? 0)}
          icon={ArrowDownLeft}
          hint="nel periodo filtrato"
        />
        <StatCard
          label="Uscite"
          value={formatCurrency(data?.totals.expense ?? 0)}
          icon={ArrowUpRight}
          hint="nel periodo filtrato"
        />
        <StatCard
          label="Saldo periodo"
          value={formatCurrency(data?.totals.net ?? 0)}
          icon={Wallet}
          hint={`${data?.totals.count ?? 0} movimenti`}
        />
      </div>

      <div className="card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Cerca descrizione o note…"
              className="pl-10"
              aria-label="Cerca movimenti"
            />
          </div>
          <div className="flex items-center gap-2">
            <SegmentedControl options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} size="sm" fullWidth />
            <Button
              variant={showFilters ? 'secondary' : 'ghost'}
              size="sm"
              icon={<SlidersHorizontal className="h-4 w-4" />}
              onClick={() => setShowFilters((value) => !value)}
              className="shrink-0"
            >
              <span className="hidden sm:inline">Filtri</span>
              {activeFilters > 0 ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">
                  {activeFilters}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        {showFilters ? (
          <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
              aria-label="Filtra per conto"
            >
              <option value="">Tutti i conti</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            <Select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filtra per categoria"
            >
              <option value="">Tutte le categorie</option>
              <optgroup label="Uscite">
                {categories
                  .filter((category) => category.type === 'expense')
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Entrate">
                {categories
                  .filter((category) => category.type === 'income')
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </optgroup>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              aria-label="Data iniziale"
              max={dateTo || todayISO()}
            />
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                aria-label="Data finale"
                min={dateFrom}
              />
              <Button variant="ghost" size="sm" onClick={resetFilters} disabled={activeFilters === 0}>
                Azzera
              </Button>
            </div>
          </div>
        ) : null}

        {activeFilters > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-[11px] font-medium text-muted">Filtri attivi:</span>
            {typeFilter !== 'all' ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink">
                {TYPE_OPTIONS.find((option) => option.value === typeFilter)?.label}
              </span>
            ) : null}
            {accountFilter ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink">
                {accounts.find((account) => String(account.id) === accountFilter)?.name}
              </span>
            ) : null}
            {categoryFilter ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink">
                {categories.find((category) => String(category.id) === categoryFilter)?.name}
              </span>
            ) : null}
            {dateFrom ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink">dal {formatDate(dateFrom)}</span>
            ) : null}
            {dateTo ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink">al {formatDate(dateTo)}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {transactionsQuery.isLoading ? (
        <div className="card space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ArrowLeftRight}
            title={activeFilters > 0 ? 'Nessun movimento trovato' : 'Nessun movimento registrato'}
            description={
              activeFilters > 0
                ? 'Prova a modificare i filtri o ad azzerare la ricerca.'
                : 'Registra la tua prima entrata o spesa per iniziare a costruire il quadro.'
            }
            action={
              activeFilters > 0 ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Azzera filtri
                </Button>
              ) : (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Nuovo movimento
                </Button>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-line bg-surface-2/60 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted">
                    <th className="px-5 py-3 font-semibold">Data</th>
                    <th className="px-3 py-3 font-semibold">Descrizione</th>
                    <th className="px-3 py-3 font-semibold">Categoria</th>
                    <th className="px-3 py-3 font-semibold">Conto</th>
                    <th className="px-3 py-3 text-right font-semibold">Importo</th>
                    <th className="px-5 py-3 text-right font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((transaction) => (
                    <tr key={transaction.id} className="group transition hover:bg-surface-2/50">
                      <td className="whitespace-nowrap px-5 py-3 text-[12px] text-muted">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="max-w-[280px] px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                            style={{
                              backgroundColor: transaction.category
                                ? `${transaction.category.color}18`
                                : 'var(--surface-2)',
                              color: transaction.category?.color ?? 'var(--muted)',
                            }}
                          >
                            {transaction.category ? (
                              <AppIcon name={transaction.category.icon} className="h-3.5 w-3.5" />
                            ) : (
                              <TypeIcon type={transaction.type} className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">{transaction.description}</p>
                            {transaction.notes ? (
                              <p className="truncate text-[11px] text-muted">{transaction.notes}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {transaction.category ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: transaction.category.color }}
                            />
                            {transaction.category.name}
                          </span>
                        ) : (
                          <span className="text-[12px] text-muted">
                            {transaction.type === 'transfer' ? 'Trasferimento' : 'Senza categoria'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[12px] text-muted">
                        {transaction.type === 'transfer' ? (
                          <span className="inline-flex items-center gap-1">
                            {transaction.account.name}
                            <ArrowLeftRight className="h-3 w-3" />
                            {transaction.transfer_account?.name}
                          </span>
                        ) : (
                          transaction.account.name
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-[13px]">
                        <Amount transaction={transaction} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                          <RowActions transaction={transaction} onEdit={openEdit} onDelete={setDeleting} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4 md:hidden">
            {groups.map((group) => (
              <div key={group.date}>
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {relativeDay(group.date)}
                  </p>
                  <p className="num text-[10px] text-muted">{group.items.length} movimenti</p>
                </div>
                <div className="card divide-y divide-line overflow-hidden">
                  {group.items.map((transaction) => (
                    <div key={transaction.id} className="flex items-center gap-2 px-3.5 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(transaction)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                          style={{
                            backgroundColor: transaction.category
                              ? `${transaction.category.color}18`
                              : 'var(--surface-2)',
                            color: transaction.category?.color ?? 'var(--muted)',
                          }}
                        >
                          {transaction.category ? (
                            <AppIcon name={transaction.category.icon} className="h-4 w-4" />
                          ) : (
                            <TypeIcon type={transaction.type} className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink">{transaction.description}</p>
                          <p className="truncate text-[11px] text-muted">
                            {transaction.category?.name ?? (transaction.type === 'transfer' ? 'Trasferimento' : 'Senza categoria')}{' '}
                            · {transaction.type === 'transfer' ? `${transaction.account.name} → ${transaction.transfer_account?.name}` : transaction.account.name}
                          </p>
                        </div>
                        <span className="shrink-0 text-[13px]">
                          <Amount transaction={transaction} />
                        </span>
                      </button>
                      <IconButton label="Elimina movimento" variant="danger" onClick={() => setDeleting(transaction)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {data ? (
            <div className="flex flex-col items-center justify-between gap-3 text-[12px] text-muted sm:flex-row">
              <p>
                {data.total === 0
                  ? 'Nessun movimento'
                  : `Mostrando ${(data.page - 1) * data.page_size + 1}–${Math.min(
                      data.page * data.page_size,
                      data.total,
                    )} di ${data.total}`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={data.page <= 1 || transactionsQuery.isFetching}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Precedente
                </Button>
                <span className="px-1 text-[11px]">
                  {data.page} / {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={data.page >= totalPages || transactionsQuery.isFetching}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Successiva
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        transaction={editing}
        defaultType={defaultType}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Eliminare il movimento?"
        description={
          deleting
            ? `Stai per eliminare "${deleting.description}" da ${formatCurrency(deleting.amount)}. I saldi dei conti verranno aggiornati.`
            : ''
        }
        confirmLabel="Elimina"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
