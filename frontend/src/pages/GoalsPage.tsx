import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronDown,
  Flag,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { api } from '../lib/api'
import type { Goal } from '../types'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatDate, formatPercent } from '../lib/format'
import { daysBetween, parseAmount, todayISO, clamp } from '../lib/utils'
import { AppIcon } from '../lib/icons'
import { Button, IconButton } from '../components/ui/Button'
import { Field, FormError, Input, Textarea } from '../components/ui/Field'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import {
  Badge,
  ColorIconPicker,
  EmptyState,
  PageHeader,
  Progress,
  Skeleton,
  StatCard,
} from '../components/ui/Primitives'

const GOAL_COLORS = ['#0E7C66', '#0EA5E9', '#8B5CF6', '#EC4899', '#F97316', '#84CC16']

function ProgressRing({
  value,
  color,
  size = 72,
  stroke = 7,
}: {
  value: number
  color: string
  size?: number
  stroke?: number
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = clamp(value, 0, 100)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (percentage / 100) * circumference}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-[12px] font-bold text-ink">
        {formatPercent(percentage, 0)}
      </span>
    </div>
  )
}

interface GoalModalProps {
  open: boolean
  onClose: () => void
  goal: Goal | null
  index: number
}

function GoalModal({ open, onClose, goal, index }: GoalModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [color, setColor] = useState(GOAL_COLORS[0])
  const [icon, setIcon] = useState('target')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (goal) {
      setName(goal.name)
      setTarget(String(goal.target_amount).replace('.', ','))
      setTargetDate(goal.target_date ?? '')
      setColor(goal.color)
      setIcon(goal.icon)
      setNotes(goal.notes ?? '')
    } else {
      setName('')
      setTarget('')
      setTargetDate('')
      setColor(GOAL_COLORS[index % GOAL_COLORS.length])
      setIcon('target')
      setNotes('')
    }
  }, [open, goal, index])

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      goal ? api.patch<Goal>(`/goals/${goal.id}`, payload) : api.post<Goal>('/goals', payload),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success(goal ? 'Obiettivo aggiornato' : 'Obiettivo creato')
      onClose()
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Dai un nome all’obiettivo')
      return
    }
    const parsed = parseAmount(target)
    if (!parsed || parsed <= 0) {
      setError('Inserisci un importo target maggiore di zero')
      return
    }
    mutation.mutate({
      name: name.trim(),
      target_amount: parsed,
      target_date: targetDate || null,
      color,
      icon,
      notes: notes.trim() ? notes.trim() : null,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Modifica obiettivo' : 'Nuovo obiettivo'}
      description="Dai un nome al traguardo e decidi quanto vuoi mettere da parte."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annulla
          </Button>
          <Button type="submit" form="goal-form" loading={mutation.isPending}>
            {goal ? 'Salva modifiche' : 'Crea obiettivo'}
          </Button>
        </div>
      }
    >
      <form id="goal-form" onSubmit={handleSubmit} className="space-y-5">
        {error ? <FormError message={error} /> : null}

        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            <AppIcon name={icon} className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{name || 'Il tuo prossimo traguardo'}</p>
            <p className="text-xs text-muted">Obiettivo di risparmio</p>
          </div>
        </div>

        <Field label="Nome" htmlFor="goal-name">
          <Input
            id="goal-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Es. Vacanza in Giappone, Fondo emergenze…"
            maxLength={120}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Importo target" htmlFor="goal-target">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
              <Input
                id="goal-target"
                value={target}
                onChange={(event) => setTarget(event.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0,00"
                inputMode="decimal"
                className="num pl-8 font-semibold"
              />
            </div>
          </Field>
          <Field label="Data target" htmlFor="goal-date" hint="Facoltativa">
            <Input
              id="goal-date"
              type="date"
              value={targetDate}
              min={todayISO()}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Note" htmlFor="goal-notes" hint="Facoltative">
          <Textarea
            id="goal-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="min-h-20"
            placeholder="Perché questo obiettivo è importante?"
            maxLength={2000}
          />
        </Field>

        <ColorIconPicker color={color} icon={icon} onColorChange={setColor} onIconChange={setIcon} />
      </form>
    </Modal>
  )
}

function ContributionModal({
  open,
  onClose,
  goal,
}: {
  open: boolean
  onClose: () => void
  goal: Goal | null
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setDate(todayISO())
    setNote('')
    setError(null)
  }, [open])

  const mutation = useMutation({
    mutationFn: (payload: { amount: number; date: string; note: string | null }) =>
      api.post<Goal>(`/goals/${goal?.id}/contributions`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Versamento aggiunto')
      onClose()
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const parsed = parseAmount(amount)
    if (!parsed || parsed <= 0) {
      setError('Inserisci un importo maggiore di zero')
      return
    }
    mutation.mutate({ amount: parsed, date, note: note.trim() ? note.trim() : null })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? `Versamento · ${goal.name}` : 'Nuovo versamento'}
      description={
        goal
          ? `Mancano ${formatCurrency(goal.remaining)} per raggiungere l'obiettivo.`
          : 'Aggiungi denaro al tuo obiettivo.'
      }
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annulla
          </Button>
          <Button type="submit" form="contribution-form" loading={mutation.isPending}>
            Aggiungi versamento
          </Button>
        </div>
      }
    >
      <form id="contribution-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? <FormError message={error} /> : null}
        <Field label="Importo" htmlFor="contribution-amount">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
            <Input
              id="contribution-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder="0,00"
              inputMode="decimal"
              className="num pl-8 text-xl font-bold"
              autoFocus
            />
          </div>
        </Field>
        <Field label="Data" htmlFor="contribution-date">
          <Input
            id="contribution-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field label="Nota" htmlFor="contribution-note" hint="Facoltativa">
          <Input
            id="contribution-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Es. Versamento mensile"
            maxLength={200}
          />
        </Field>
      </form>
    </Modal>
  )
}

export function GoalsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [contributing, setContributing] = useState<Goal | null>(null)
  const [deleting, setDeleting] = useState<Goal | null>(null)

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get<Goal[]>('/goals'),
  })

  const deleteMutation = useMutation({
    mutationFn: (goal: Goal) => api.delete(`/goals/${goal.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Obiettivo eliminato')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteContributionMutation = useMutation({
    mutationFn: ({ goalId, contributionId }: { goalId: number; contributionId: number }) =>
      api.delete<Goal>(`/goals/${goalId}/contributions/${contributionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Versamento rimosso')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const totalSaved = goals.reduce((sum, goal) => sum + goal.contributed, 0)
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target_amount, 0)
  const completed = goals.filter((goal) => goal.is_reached).length

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (goal: Goal) => {
    setEditing(goal)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Obiettivi"
        title="I tuoi traguardi"
        subtitle="Trasforma i risparmi in progetti concreti, un versamento alla volta."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nuovo obiettivo
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-64 rounded-3xl" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Flag}
            title="Nessun obiettivo ancora"
            description="Un viaggio, un fondo di emergenza, un nuovo computer: scegli un traguardo e inizia a mettere da parte. Saldo calcolerà quanto ti serve ogni mese."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Crea il primo obiettivo
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              featured
              label="Messo da parte"
              value={formatCurrency(totalSaved)}
              icon={Wallet}
              hint={`su ${formatCurrency(totalTarget, { decimals: 0 })} di obiettivi`}
            />
            <StatCard
              label="Obiettivi attivi"
              value={String(goals.length - completed)}
              icon={Target}
              hint={`${goals.length} totali`}
            />
            <StatCard
              label="Completati"
              value={String(completed)}
              icon={Sparkles}
              hint={completed > 0 ? 'complimenti!' : 'il primo traguardo ti aspetta'}
            />
            <StatCard
              label="Avanzamento medio"
              value={formatPercent(totalTarget ? (totalSaved / totalTarget) * 100 : 0, 0)}
              icon={Flag}
              hint="su tutti gli obiettivi"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal, index) => {
              const monthsLeft = goal.target_date
                ? Math.max(1, Math.ceil(daysBetween(todayISO(), goal.target_date) / 30))
                : null
              const monthlyNeeded = monthsLeft ? goal.remaining / monthsLeft : null
              return (
                <article
                  key={goal.id}
                  className="card flex flex-col p-5 transition hover:border-line-strong"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="grid h-9 w-9 place-items-center rounded-xl"
                        style={{ backgroundColor: `${goal.color}1c`, color: goal.color }}
                      >
                        <AppIcon name={goal.icon} className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-[14.5px] font-bold leading-snug text-ink">{goal.name}</h3>
                        {goal.target_date ? (
                          <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(goal.target_date)}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[10.5px] text-muted">Senza scadenza</p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <IconButton label="Modifica obiettivo" onClick={() => openEdit(goal)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Elimina obiettivo" variant="danger" onClick={() => setDeleting(goal)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-4">
                    <ProgressRing value={goal.percentage} color={goal.color} />
                    <div className="min-w-0 flex-1">
                      <p className="num font-display text-[23px] font-extrabold leading-none tracking-tight text-ink">
                        {formatCurrency(goal.contributed)}
                      </p>
                      <p className="num mt-1 text-[11.5px] text-muted">
                        di {formatCurrency(goal.target_amount)}
                      </p>
                      {goal.is_reached ? (
                        <Badge variant="success" className="mt-2">
                          <Sparkles className="h-3 w-3" /> Raggiunto
                        </Badge>
                      ) : (
                        <p className="mt-2 text-[11px] text-muted">
                          Mancano <span className="font-semibold text-ink">{formatCurrency(goal.remaining)}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex min-h-[50px] items-center rounded-xl bg-surface-2 px-3 py-2">
                    {goal.is_reached ? (
                      <p className="text-[11px] leading-relaxed text-muted">
                        Obiettivo raggiunto. Puoi alzare il target o iniziare un nuovo progetto.
                      </p>
                    ) : monthlyNeeded !== null ? (
                      <p className="text-[11px] leading-relaxed text-muted">
                        Ti servono circa{' '}
                        <span className="font-semibold text-ink">{formatCurrency(monthlyNeeded)}</span> al mese
                        per {monthsLeft} {monthsLeft === 1 ? 'mese' : 'mesi'}.
                      </p>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-muted">
                        Aggiungi una data target per calcolare il ritmo di risparmio.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => setContributing(goal)}
                    >
                      Aggiungi denaro
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(goal)}>
                      Modifica
                    </Button>
                  </div>

                  {goal.contributions.length > 0 ? (
                    <details className="group mt-3 border-t border-line pt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-medium text-muted">
                        Versamenti ({goal.contributions.length})
                        <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                        {goal.contributions.map((contribution) => (
                          <div
                            key={contribution.id}
                            className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[11px] hover:bg-surface-2"
                          >
                            <span className="w-14 shrink-0 text-muted">{formatDate(contribution.date)}</span>
                            <span className="min-w-0 flex-1 truncate text-ink">
                              {contribution.note ?? 'Versamento'}
                            </span>
                            <span className="num font-semibold text-ink">
                              {formatCurrency(contribution.amount)}
                            </span>
                            <button
                              type="button"
                              aria-label="Rimuovi versamento"
                              onClick={() =>
                                deleteContributionMutation.mutate({
                                  goalId: goal.id,
                                  contributionId: contribution.id,
                                })
                              }
                              className="rounded p-0.5 text-muted transition hover:bg-danger-soft hover:text-danger"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </article>
              )
            })}

            <button
              type="button"
              onClick={openCreate}
              className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line-strong bg-surface-2/40 p-5 text-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent-ink"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface">
                <Plus className="h-5 w-5" />
              </span>
              <span className="text-[13px] font-semibold">Nuovo obiettivo</span>
              <span className="text-[11px] text-muted">Un viaggio, un fondo, un acquisto</span>
            </button>
          </div>
        </>
      )}

      <GoalModal open={modalOpen} onClose={() => setModalOpen(false)} goal={editing} index={goals.length} />
      <ContributionModal open={contributing !== null} onClose={() => setContributing(null)} goal={contributing} />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        title="Eliminare l’obiettivo?"
        description={
          deleting
            ? `"${deleting.name}" e i suoi ${deleting.contributions_count} versamenti verranno rimossi definitivamente.`
            : ''
        }
        confirmLabel="Elimina obiettivo"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
