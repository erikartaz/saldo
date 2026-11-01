import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import type { Account, AccountType } from '../types'
import { useToast } from '../context/ToastContext'
import { formatCurrency } from '../lib/format'
import { ACCOUNT_TYPES, cn, PALETTE, parseAmount } from '../lib/utils'
import { AppIcon } from '../lib/icons'
import { Button, IconButton } from '../components/ui/Button'
import { Field, FormError, Input, Select, Textarea } from '../components/ui/Field'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import {
  Badge,
  ColorIconPicker,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
  ToggleRow,
} from '../components/ui/Primitives'

const ACCOUNT_TYPE_OPTIONS = Object.entries(ACCOUNT_TYPES) as [AccountType, (typeof ACCOUNT_TYPES)[AccountType]][]

interface AccountModalProps {
  open: boolean
  onClose: () => void
  account: Account | null
  defaultColor: string
}

function AccountModal({ open, onClose, account, defaultColor }: AccountModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [initialBalance, setInitialBalance] = useState('')
  const [color, setColor] = useState(defaultColor)
  const [icon, setIcon] = useState('wallet')
  const [notes, setNotes] = useState('')
  const [archived, setArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (account) {
      setName(account.name)
      setType(account.type)
      setInitialBalance(String(account.initial_balance).replace('.', ','))
      setColor(account.color)
      setIcon(account.icon)
      setNotes(account.notes ?? '')
      setArchived(account.archived)
    } else {
      setName('')
      setType('checking')
      setInitialBalance('')
      setColor(defaultColor)
      setIcon('landmark')
      setNotes('')
      setArchived(false)
    }
  }, [open, account, defaultColor])

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      account
        ? api.patch<Account>(`/accounts/${account.id}`, payload)
        : api.post<Account>('/accounts', payload),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success(account ? 'Conto aggiornato' : 'Conto creato')
      onClose()
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Dai un nome al conto')
      return
    }
    mutation.mutate({
      name: name.trim(),
      type,
      initial_balance: parseAmount(initialBalance),
      color,
      icon,
      notes: notes.trim() ? notes.trim() : null,
      archived,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? 'Modifica conto' : 'Nuovo conto'}
      description={
        account
          ? 'Aggiorna i dettagli del conto. Il saldo iniziale modifica il patrimonio calcolato.'
          : 'Aggiungi un conto per iniziare a registrare i movimenti.'
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annulla
          </Button>
          <Button type="submit" form="account-form" loading={mutation.isPending}>
            {account ? 'Salva modifiche' : 'Crea conto'}
          </Button>
        </div>
      }
    >
      <form id="account-form" onSubmit={handleSubmit} className="space-y-5">
        {error ? <FormError message={error} /> : null}

        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            <AppIcon name={icon} className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{name || 'Il tuo nuovo conto'}</p>
            <p className="text-xs text-muted">{ACCOUNT_TYPES[type].label}</p>
          </div>
        </div>

        <Field label="Nome del conto" htmlFor="account-name">
          <Input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Es. Conto principale, Risparmi, Carta…"
            maxLength={120}
          />
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink">Tipo di conto</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACCOUNT_TYPE_OPTIONS.map(([value, config]) => {
              const active = type === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setType(value)
                    setIcon(config.icon)
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition',
                    active
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface-2 text-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  <AppIcon name={config.icon} className="h-4 w-4 shrink-0" />
                  <span className="text-[12px] font-medium">{config.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Saldo iniziale"
            htmlFor="account-balance"
            hint="Può essere negativo per carte o debiti."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
              <Input
                id="account-balance"
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value.replace(/[^0-9.,-]/g, ''))}
                placeholder="0,00"
                inputMode="decimal"
                className="num pl-8"
              />
            </div>
          </Field>
          <Field label="Note" htmlFor="account-notes" hint="Facoltative">
            <Textarea
              id="account-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Es. conto cointestato…"
              rows={1}
              className="min-h-11 py-2.5"
            />
          </Field>
        </div>

        <ColorIconPicker color={color} icon={icon} onColorChange={setColor} onIconChange={setIcon} />

        {account ? (
          <ToggleRow
            checked={archived}
            onChange={setArchived}
            label="Archivia conto"
            description="I conti archiviati non entrano nel patrimonio ma restano consultabili."
          />
        ) : null}
      </form>
    </Modal>
  )
}

export function AccountsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/accounts'),
  })

  const archiveMutation = useMutation({
    mutationFn: ({ account, archived }: { account: Account; archived: boolean }) =>
      api.patch<Account>(`/accounts/${account.id}`, { archived }),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Conto aggiornato')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (account: Account) => api.delete(`/accounts/${account.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Conto eliminato')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const activeAccounts = accounts.filter((account) => !account.archived)
  const archivedAccounts = accounts.filter((account) => account.archived)
  const total = activeAccounts.reduce((sum, account) => sum + account.balance, 0)
  const visibleAccounts = showArchived ? accounts : activeAccounts
  const totalTransactions = accounts.reduce((sum, account) => sum + account.transaction_count, 0)

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (account: Account) => {
    setEditing(account)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conti"
        title="I tuoi conti"
        subtitle="Tieni insieme banca, risparmi, contanti e carte in un unico patrimonio."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nuovo conto
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Landmark}
            title="Nessun conto configurato"
            description="Crea il tuo primo conto per dare un posto a ogni movimento. Puoi aggiungere conti correnti, risparmi, contanti e carte."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Crea il primo conto
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              featured
              label="Patrimonio attivo"
              value={formatCurrency(total)}
              icon={Wallet}
              hint={`${activeAccounts.length} conti attivi`}
            />
            <StatCard
              label="Conti totali"
              value={String(accounts.length)}
              icon={Landmark}
              hint={archivedAccounts.length > 0 ? `${archivedAccounts.length} archiviati` : 'Tutti attivi'}
            />
            <StatCard
              label="Movimenti registrati"
              value={String(totalTransactions)}
              icon={ArrowLeftRight}
              hint="su tutti i conti"
            />
            <StatCard
              label="Saldo medio"
              value={formatCurrency(activeAccounts.length ? total / activeAccounts.length : 0)}
              icon={Wallet}
              hint="per conto attivo"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-ink">
                {showArchived ? 'Tutti i conti' : 'Conti attivi'}
              </h2>
              <p className="text-xs text-muted">
                {showArchived ? `${accounts.length} conti` : `${activeAccounts.length} conti`}
              </p>
            </div>
            {archivedAccounts.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchived((value) => !value)}
                icon={<Archive className="h-4 w-4" />}
              >
                {showArchived ? 'Nascondi archiviati' : `Mostra archiviati (${archivedAccounts.length})`}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleAccounts.map((account) => (
              <article
                key={account.id}
                className={cn('card group relative overflow-hidden p-5', account.archived && 'opacity-75')}
              >
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: account.color }}
                  aria-hidden="true"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-11 w-11 place-items-center rounded-xl"
                      style={{ backgroundColor: `${account.color}1c`, color: account.color }}
                    >
                      <AppIcon name={account.icon} className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted">
                        {ACCOUNT_TYPES[account.type]?.label ?? account.type}
                      </p>
                      <h3 className="mt-0.5 text-[15px] font-bold text-ink">{account.name}</h3>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <IconButton label="Modifica conto" onClick={() => openEdit(account)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={account.archived ? 'Ripristina conto' : 'Archivia conto'}
                      onClick={() => archiveMutation.mutate({ account, archived: !account.archived })}
                    >
                      {account.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </IconButton>
                    <IconButton label="Elimina conto" variant="danger" onClick={() => setDeleting(account)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                <p
                  className={cn(
                    'num mt-6 font-display text-[26px] font-extrabold tracking-tight',
                    account.balance < 0 ? 'text-danger' : 'text-ink',
                  )}
                >
                  {formatCurrency(account.balance)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <span className="text-[11px] text-muted">
                    Saldo iniziale {formatCurrency(account.initial_balance)}
                  </span>
                  <span className="text-muted/40">·</span>
                  <span className="text-[11px] text-muted">{account.transaction_count} movimenti</span>
                  {account.archived ? (
                    <Badge variant="warning" className="ml-auto">
                      Archiviato
                    </Badge>
                  ) : null}
                  {account.notes ? (
                    <p className="w-full truncate text-[11px] text-muted/80">{account.notes}</p>
                  ) : null}
                </div>
              </article>
            ))}

            <button
              type="button"
              onClick={openCreate}
              className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line-strong bg-surface-2/40 p-5 text-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent-ink"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface">
                <Plus className="h-5 w-5" />
              </span>
              <span className="text-[13px] font-semibold">Aggiungi conto</span>
              <span className="text-[11px] text-muted">Conto, risparmio, carta o contanti</span>
            </button>
          </div>
        </>
      )}

      <AccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        account={editing}
        defaultColor={PALETTE[accounts.length % PALETTE.length]}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        title="Eliminare il conto?"
        description={
          deleting
            ? deleting.transaction_count > 0
              ? `"${deleting.name}" ha ${deleting.transaction_count} movimenti collegati. Archivialo per conservare lo storico.`
              : `"${deleting.name}" verrà eliminato definitivamente.`
            : ''
        }
        confirmLabel="Elimina conto"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
