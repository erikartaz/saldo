import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Wallet } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { ACCOUNT_TYPES, cn, parseAmount, todayISO } from '../lib/utils'
import type { Account, Category, Transaction, TransactionInput, TransactionType } from '../types'
import { useToast } from '../context/ToastContext'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, FormError, Input, Select, Textarea } from './ui/Field'
import { SegmentedControl } from './ui/Primitives'

interface TransactionModalProps {
  open: boolean
  onClose: () => void
  transaction?: Transaction | null
  defaultType?: TransactionType
}

const TYPE_OPTIONS = [
  { value: 'expense' as const, label: 'Spesa', icon: ArrowUpRight },
  { value: 'income' as const, label: 'Entrata', icon: ArrowDownLeft },
  { value: 'transfer' as const, label: 'Trasferimento', icon: ArrowLeftRight },
]

export function TransactionModal({ open, onClose, transaction, defaultType = 'expense' }: TransactionModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [type, setType] = useState<TransactionType>(defaultType)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayISO())
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [transferAccountId, setTransferAccountId] = useState('')
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

  const accounts = accountsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const activeAccounts = accounts.filter((account) => !account.archived || account.id === transaction?.account_id)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (transaction) {
      setType(transaction.type)
      setAmount(String(transaction.amount).replace('.', ','))
      setDescription(transaction.description)
      setDate(transaction.date)
      setAccountId(String(transaction.account_id))
      setCategoryId(transaction.category_id ? String(transaction.category_id) : '')
      setTransferAccountId(
        transaction.transfer_account_id ? String(transaction.transfer_account_id) : '',
      )
      setNotes(transaction.notes ?? '')
    } else {
      setType(defaultType)
      setAmount('')
      setDescription('')
      setDate(todayISO())
      setAccountId('')
      setCategoryId('')
      setTransferAccountId('')
      setNotes('')
    }
  }, [open, transaction, defaultType])

  useEffect(() => {
    if (!open || accountId) return
    const first = activeAccounts.find((account) => !account.archived) ?? activeAccounts[0]
    if (first) setAccountId(String(first.id))
  }, [open, accountId, activeAccounts])

  const visibleCategories = categories.filter(
    (category) =>
      category.type === type &&
      (!category.archived || category.id === transaction?.category_id),
  )

  const selectedAccount = accounts.find((account) => String(account.id) === accountId)
  const destinationOptions = activeAccounts.filter((account) => String(account.id) !== accountId)

  const mutation = useMutation({
    mutationFn: (payload: TransactionInput) =>
      transaction
        ? api.put<Transaction>(`/transactions/${transaction.id}`, payload)
        : api.post<Transaction>('/transactions', payload),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success(transaction ? 'Movimento aggiornato' : 'Movimento registrato')
      onClose()
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType)
    setError(null)
    if (nextType === 'transfer') {
      setCategoryId('')
    } else {
      setTransferAccountId('')
      const current = categories.find((category) => String(category.id) === categoryId)
      if (current && current.type !== nextType) setCategoryId('')
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const parsedAmount = parseAmount(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Inserisci un importo maggiore di zero')
      return
    }
    if (!description.trim()) {
      setError('Aggiungi una descrizione al movimento')
      return
    }
    if (!accountId) {
      setError('Seleziona il conto')
      return
    }
    if (type === 'transfer') {
      if (!transferAccountId) {
        setError('Seleziona il conto di destinazione')
        return
      }
      if (transferAccountId === accountId) {
        setError('I due conti devono essere diversi')
        return
      }
    }
    mutation.mutate({
      type,
      amount: parsedAmount,
      date,
      description: description.trim(),
      account_id: Number(accountId),
      category_id: type === 'transfer' || !categoryId ? null : Number(categoryId),
      transfer_account_id: type === 'transfer' ? Number(transferAccountId) : null,
      notes: notes.trim() ? notes.trim() : null,
    })
  }

  const formId = 'transaction-form'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? 'Modifica movimento' : 'Nuovo movimento'}
      description={
        transaction ? 'Aggiorna i dettagli del movimento selezionato.' : 'Registra un’entrata, una spesa o un giroconto tra conti.'
      }
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annulla
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            {transaction ? 'Salva modifiche' : 'Registra movimento'}
          </Button>
        </div>
      }
    >
      {accountsQuery.isLoading ? (
        <div className="space-y-3">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-11 w-full" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted">
            <Wallet className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-ink">Crea prima un conto</h3>
          <p className="mt-1 text-[13px] text-muted">
            Ogni movimento deve essere collegato a un conto. Aggiungine uno per iniziare.
          </p>
          <Button className="mt-4" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      ) : (
        <form id={formId} onSubmit={handleSubmit} className="space-y-5">
          {error ? <FormError message={error} /> : null}

          <SegmentedControl
            options={TYPE_OPTIONS}
            value={type}
            onChange={handleTypeChange}
            fullWidth
          />

          <div className="rounded-2xl border border-line bg-surface-2 px-4 py-4">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Importo</p>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="font-display text-2xl font-semibold text-muted">€</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0,00"
                inputMode="decimal"
                autoFocus
                aria-label="Importo"
                className="num w-full max-w-[220px] bg-transparent text-center font-display text-[40px] font-extrabold leading-none tracking-tight text-ink outline-none placeholder:text-muted/35"
              />
            </div>
          </div>

          <Field label="Descrizione" htmlFor="tx-description">
            <Input
              id="tx-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={type === 'transfer' ? 'Es. Giroconto risparmi' : 'Es. Spesa supermercato'}
              maxLength={200}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Data" htmlFor="tx-date">
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field label={type === 'transfer' ? 'Dal conto' : 'Conto'} htmlFor="tx-account">
              <Select
                id="tx-account"
                value={accountId}
                onChange={(event) => {
                  setAccountId(event.target.value)
                  if (event.target.value === transferAccountId) setTransferAccountId('')
                }}
              >
                <option value="">Seleziona conto</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {type !== 'transfer' ? (
            <Field
              label="Categoria"
              htmlFor="tx-category"
              hint={selectedAccount ? `Saldo disponibile: ${formatCurrency(selectedAccount.balance)}` : undefined}
            >
              <Select
                id="tx-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Senza categoria</option>
                {visibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Al conto" htmlFor="tx-destination">
              <Select
                id="tx-destination"
                value={transferAccountId}
                onChange={(event) => setTransferAccountId(event.target.value)}
              >
                <option value="">Seleziona destinazione</option>
                {destinationOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {ACCOUNT_TYPES[account.type]?.label ?? account.type}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Note" htmlFor="tx-notes" hint="Facoltative">
            <Textarea
              id="tx-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Aggiungi un dettaglio utile…"
              rows={2}
              maxLength={2000}
              className={cn('min-h-20')}
            />
          </Field>
        </form>
      )}
    </Modal>
  )
}
