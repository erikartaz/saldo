import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Payee, TransactionType } from '../types'
import { useToast } from '../context/ToastContext'
import { Combobox } from './ui/Combobox'

interface PayeeFieldProps {
  id?: string
  value: number | null
  onChange: (value: number | null) => void
  onPayeeSelected?: (payee: Payee | null) => void
  type: TransactionType
  autoFocus?: boolean
}

export function PayeeField({
  id,
  value,
  onChange,
  onPayeeSelected,
  type,
  autoFocus = false,
}: PayeeFieldProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [text, setText] = useState('')

  const { data: payees = [], isLoading } = useQuery({
    queryKey: ['payees', 'all'],
    queryFn: () => api.get<Payee[]>('/payees', { include_archived: true, limit: 1000, sort: 'recent' }),
  })

  useEffect(() => {
    if (value === null) return
    const payee = payees.find((item) => item.id === value)
    if (payee && payee.name !== text) setText(payee.name)
    // The text is intentionally not reset when value is null: the user may be typing a new name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, payees])

  const options = useMemo(
    () =>
      payees
        .filter((payee) => !payee.archived || payee.id === value)
        .map((payee) => ({
          value: String(payee.id),
          label: payee.name,
          hint: payee.archived
            ? 'Archiviato'
            : payee.default_category?.name ?? undefined,
        })),
    [payees, value],
  )

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<Payee>('/payees', { name, default_category_id: null }),
    onSuccess: (payee) => {
      queryClient.invalidateQueries({ queryKey: ['payees'] })
      setText(payee.name)
      onChange(payee.id)
      onPayeeSelected?.(payee)
      toast.success('Beneficiario creato')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const handleChange = (next: string) => {
    setText(next)
    const normalized = next.trim().toLowerCase()
    if (!normalized) {
      onChange(null)
      onPayeeSelected?.(null)
      return
    }
    const match = payees.find((payee) => payee.name.trim().toLowerCase() === normalized)
    if (match) {
      onChange(match.id)
      onPayeeSelected?.(match)
    } else {
      onChange(null)
      onPayeeSelected?.(null)
    }
  }

  const handleSelect = (option: { value: string; label: string }) => {
    const payload = payees.find((payee) => String(payee.id) === option.value)
    setText(option.label)
    if (payload) {
      onChange(payload.id)
      onPayeeSelected?.(payload)
    }
  }

  return (
    <Combobox
      id={id}
      value={text}
      onChange={handleChange}
      onSelect={handleSelect}
      options={options}
      placeholder={type === 'income' ? 'Es. Datore di lavoro, cliente…' : 'Es. Esselunga, Enel…'}
      allowCreate
      onCreate={(name) => createMutation.mutateAsync(name).then(() => undefined)}
      createLabel={(name) => `Crea beneficiario «${name}»`}
      loading={isLoading || createMutation.isPending}
      emptyText="Nessun beneficiario: scrivi un nome per crearlo"
      autoFocus={autoFocus}
    />
  )
}
