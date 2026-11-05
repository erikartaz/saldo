import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import { api } from '../lib/api'
import type { Category, Payee } from '../types'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDate } from '../lib/format'
import { cn } from '../lib/utils'
import { Button, IconButton } from '../components/ui/Button'
import { Field, FormError, Input, Select, Textarea } from '../components/ui/Field'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import {
  Badge,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
  ToggleRow,
  Avatar,
} from '../components/ui/Primitives'

interface PayeeModalProps {
  open: boolean
  onClose: () => void
  payee: Payee | null
  categories: Category[]
}

function PayeeModal({ open, onClose, payee, categories }: PayeeModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [defaultCategoryId, setDefaultCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [archived, setArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (payee) {
      setName(payee.name)
      setDefaultCategoryId(payee.default_category_id ? String(payee.default_category_id) : '')
      setNotes(payee.notes ?? '')
      setArchived(payee.archived)
    } else {
      setName('')
      setDefaultCategoryId('')
      setNotes('')
      setArchived(false)
    }
  }, [open, payee])

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      payee
        ? api.patch<Payee>(`/payees/${payee.id}`, payload)
        : api.post<Payee>('/payees', payload),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success(payee ? 'Beneficiario aggiornato' : 'Beneficiario creato')
      onClose()
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Dai un nome al beneficiario')
      return
    }
    mutation.mutate({
      name: name.trim(),
      default_category_id: defaultCategoryId ? Number(defaultCategoryId) : null,
      notes: notes.trim() ? notes.trim() : null,
      archived,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={payee ? 'Modifica beneficiario' : 'Nuovo beneficiario'}
      description="Usa lo stesso nome per tutti i movimenti: Saldo li raggrupperà nelle statistiche."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annulla
          </Button>
          <Button type="submit" form="payee-form" loading={mutation.isPending}>
            {payee ? 'Salva modifiche' : 'Crea beneficiario'}
          </Button>
        </div>
      }
    >
      <form id="payee-form" onSubmit={handleSubmit} className="space-y-5">
        {error ? <FormError message={error} /> : null}

        <Field label="Nome" htmlFor="payee-name">
          <Input
            id="payee-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Es. Esselunga, Enel, Datore di lavoro…"
            maxLength={120}
            autoFocus
          />
        </Field>

        <Field
          label="Categoria predefinita"
          htmlFor="payee-category"
          hint="Facoltativa: viene proposta quando selezioni questo beneficiario."
        >
          <Select
            id="payee-category"
            value={defaultCategoryId}
            onChange={(event) => setDefaultCategoryId(event.target.value)}
          >
            <option value="">Nessuna categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} · {category.type === 'expense' ? 'spesa' : 'entrata'}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Note" htmlFor="payee-notes" hint="Facoltative">
          <Textarea
            id="payee-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="min-h-20"
            placeholder="Es. negozio sotto casa…"
            maxLength={1000}
          />
        </Field>

        {payee ? (
          <ToggleRow
            checked={archived}
            onChange={setArchived}
            label="Archivia beneficiario"
            description="Resta nei movimenti storici ma non viene proposto nei nuovi inserimenti."
          />
        ) : null}
      </form>
    </Modal>
  )
}

export function PayeesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Payee | null>(null)
  const [deleting, setDeleting] = useState<Payee | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const payeesQuery = useQuery({
    queryKey: ['payees', debouncedSearch, showArchived],
    queryFn: () =>
      api.get<Payee[]>('/payees', {
        q: debouncedSearch || undefined,
        include_archived: showArchived,
        limit: 1000,
        sort: 'name',
      }),
  })
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  })

  const archiveMutation = useMutation({
    mutationFn: ({ payee, archived }: { payee: Payee; archived: boolean }) =>
      api.patch<Payee>(`/payees/${payee.id}`, { archived }),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Beneficiario aggiornato')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (payee: Payee) => api.delete(`/payees/${payee.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Beneficiario eliminato')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const payees = payeesQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const active = payees.filter((payee) => !payee.archived)
  const totalExpense = active.reduce((sum, payee) => sum + payee.expense_total, 0)
  const totalTransactions = active.reduce((sum, payee) => sum + payee.transaction_count, 0)
  const topPayee = [...active].sort((a, b) => b.expense_total - a.expense_total)[0]

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (payee: Payee) => {
    setEditing(payee)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Beneficiari"
        title="A chi vanno i tuoi soldi"
        subtitle="Supermercati, bollette, professionisti e datori di lavoro: dai un nome alle controparti per leggere meglio le spese."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nuovo beneficiario
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Beneficiari attivi" value={String(active.length)} icon={Users} hint={`${payees.length} totali`} />
        <StatCard
          label="Spese tracciate"
          value={formatCurrency(totalExpense)}
          icon={Users}
          hint={`${totalTransactions} movimenti`}
        />
        <StatCard
          label="Beneficiario principale"
          value={topPayee?.name ?? '—'}
          icon={Users}
          hint={topPayee ? formatCurrency(topPayee.expense_total) : 'Nessun dato'}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca beneficiario…"
            className="pl-10"
            aria-label="Cerca beneficiario"
          />
        </div>
        <Button
          variant={showArchived ? 'secondary' : 'ghost'}
          size="sm"
          icon={<Archive className="h-4 w-4" />}
          onClick={() => setShowArchived((value) => !value)}
        >
          {showArchived ? 'Nascondi archiviati' : 'Mostra archiviati'}
        </Button>
      </div>

      {payeesQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : payees.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={debouncedSearch ? 'Nessun beneficiario trovato' : 'Nessun beneficiario'}
            description={
              debouncedSearch
                ? 'Prova con un altro nome.'
                : 'Aggiungi i negozi e le aziende che usi più spesso. Puoi anche crearli direttamente dal form di un movimento.'
            }
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Crea il primo beneficiario
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {payees.map((payee) => (
            <article
              key={payee.id}
              className={cn(
                'card group p-4 transition hover:border-line-strong',
                payee.archived && 'opacity-70',
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar name={payee.name} className="h-10 w-10 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="truncate text-[13.5px] font-semibold text-ink">{payee.name}</h3>
                    {payee.archived ? <Badge variant="warning">Archiviato</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {payee.default_category ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: payee.default_category.color }}
                        />
                        {payee.default_category.name}
                      </span>
                    ) : (
                      'Senza categoria predefinita'
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span>
                      <span className="font-semibold text-ink">{payee.transaction_count}</span> movimenti
                    </span>
                    {payee.last_used ? <span>Ultimo: {formatDate(payee.last_used)}</span> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                    <span className="text-ink">
                      Spese <span className="num font-semibold">{formatCurrency(payee.expense_total)}</span>
                    </span>
                    {payee.income_total > 0 ? (
                      <span className="text-accent">
                        Entrate <span className="num font-semibold">{formatCurrency(payee.income_total)}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <IconButton label="Modifica beneficiario" onClick={() => openEdit(payee)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={payee.archived ? 'Ripristina beneficiario' : 'Archivia beneficiario'}
                    onClick={() => archiveMutation.mutate({ payee, archived: !payee.archived })}
                  >
                    {payee.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </IconButton>
                  <IconButton label="Elimina beneficiario" variant="danger" onClick={() => setDeleting(payee)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <PayeeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        payee={editing}
        categories={categories}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        title="Eliminare il beneficiario?"
        description={
          deleting
            ? deleting.transaction_count > 0
              ? `"${deleting.name}" è usato da ${deleting.transaction_count} movimenti. Archivialo per conservare lo storico.`
              : `"${deleting.name}" verrà rimosso definitivamente.`
            : ''
        }
        confirmLabel="Elimina beneficiario"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
