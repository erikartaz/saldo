import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Database,
  Download,
  FileJson,
  Info,
  Lock,
  Mail,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Trash2,
  User as UserIcon,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import type { AppSettings, User } from '../types'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { formatDate, formatNumber } from '../lib/format'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { Field, FormError, Input } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Avatar, Badge, PageHeader, Skeleton } from '../components/ui/Primitives'

function ProfileCard() {
  const { user, updateUser } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
  }, [user])

  const mutation = useMutation({
    mutationFn: (payload: { name: string; email: string }) => api.patch<User>('/auth/profile', payload),
    onSuccess: (updated) => {
      updateUser(updated)
      queryClient.invalidateQueries()
      toast.success('Profilo aggiornato')
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Il nome non può essere vuoto')
      return
    }
    if (!email.includes('@')) {
      setError('Inserisci un’email valida')
      return
    }
    mutation.mutate({ name: name.trim(), email: email.trim() })
  }

  return (
    <section className="card card-pad">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent-ink">
          <UserIcon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-ink">Profilo</h2>
          <p className="text-[11px] text-muted">I tuoi dati di accesso</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <Avatar name={user?.name ?? 'Saldo'} className="h-11 w-11 text-sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
        <Badge variant="success" className="ml-auto">
          Locale
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error ? <FormError message={error} /> : null}
        <Field label="Nome" htmlFor="profile-name">
          <div className="relative">
            <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="pl-10"
              maxLength={120}
            />
          </div>
        </Field>
        <Field label="Email" htmlFor="profile-email">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="pl-10"
            />
          </div>
        </Field>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted">
            {user ? `Account creato il ${formatDate(user.created_at.slice(0, 10))}` : ''}
          </p>
          <Button type="submit" size="sm" loading={mutation.isPending}>
            Salva profilo
          </Button>
        </div>
      </form>
    </section>
  )
}

function SecurityCard() {
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (payload: { current_password: string; new_password: string }) =>
      api.post('/auth/change-password', payload),
    onSuccess: () => {
      toast.success('Password aggiornata')
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setError(null)
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!currentPassword) {
      setError('Inserisci la password attuale')
      return
    }
    if (newPassword.length < 8) {
      setError('La nuova password deve avere almeno 8 caratteri')
      return
    }
    if (newPassword !== confirm) {
      setError('Le due nuove password non coincidono')
      return
    }
    if (newPassword === currentPassword) {
      setError('La nuova password deve essere diversa da quella attuale')
      return
    }
    mutation.mutate({ current_password: currentPassword, new_password: newPassword })
  }

  return (
    <section className="card card-pad">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted">
          <Lock className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-ink">Sicurezza</h2>
          <p className="text-[11px] text-muted">Password protetta con Argon2</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {error ? <FormError message={error} /> : null}
        <Field label="Password attuale" htmlFor="current-password">
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Inserisci la password attuale"
            autoComplete="current-password"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nuova password" htmlFor="new-password" hint="Almeno 8 caratteri">
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Almeno 8 caratteri"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Conferma" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Ripeti la password"
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="secondary" loading={mutation.isPending}>
            Aggiorna password
          </Button>
        </div>
      </form>
    </section>
  )
}

function AppearanceCard() {
  const { preference, setPreference } = useTheme()
  const options = [
    { value: 'light' as const, label: 'Chiaro', icon: Sun },
    { value: 'dark' as const, label: 'Scuro', icon: Moon },
    { value: 'system' as const, label: 'Sistema', icon: Monitor },
  ]

  return (
    <section className="card card-pad">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted">
          <Palette className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-ink">Aspetto</h2>
          <p className="text-[11px] text-muted">Scegli il tema dell'interfaccia</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {options.map((option) => {
          const Icon = option.icon
          const active = preference === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setPreference(option.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border px-3 py-3.5 text-[12px] font-medium transition',
                active
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-line bg-surface-2 text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Con "Sistema" Saldo segue automaticamente l'impostazione chiara o scura del tuo dispositivo.
      </p>
    </section>
  )
}

function ResetDataModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setConfirm('')
    setError(null)
  }, [open])

  const mutation = useMutation({
    mutationFn: () => api.post('/settings/reset', { password, confirm }),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Dati azzerati. Puoi ricominciare da zero.')
      onClose()
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Azzerare tutti i dati?"
      description="Verranno eliminati conti, movimenti, budget, ricorrenze e obiettivi. L'account e le categorie predefinite restano."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annulla
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            onClick={() => {
              setError(null)
              if (!password) {
                setError('Inserisci la password')
                return
              }
              if (confirm.trim().toUpperCase() !== 'ELIMINA') {
                setError('Scrivi ELIMINA per confermare')
                return
              }
              mutation.mutate()
            }}
          >
            Azzera dati
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? <FormError message={error} /> : null}
        <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2.5 text-[12px] leading-relaxed text-danger">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
          Questa operazione non può essere annullata. Esporta prima un backup se vuoi conservare lo storico.
        </div>
        <Field label="Password" htmlFor="reset-password">
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="La tua password"
            autoComplete="current-password"
          />
        </Field>
        <Field label='Scrivi "ELIMINA" per confermare' htmlFor="reset-confirm">
          <Input
            id="reset-confirm"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="ELIMINA"
          />
        </Field>
      </div>
    </Modal>
  )
}

export function SettingsPage() {
  const toast = useToast()
  const [resetOpen, setResetOpen] = useState(false)
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<AppSettings>('/settings'),
  })

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Impostazioni"
        title="Il tuo account"
        subtitle="Gestisci profilo, sicurezza, aspetto e i tuoi dati. Tutto resta sul tuo dispositivo."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <ProfileCard />
        <SecurityCard />
        <AppearanceCard />

        <section className="card card-pad">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted">
              <Database className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-ink">Dati e backup</h2>
              <p className="text-[11px] text-muted">Database SQLite locale</p>
            </div>
          </div>

          {isLoading || !settings ? (
            <div className="mt-5 space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                  <p className="label">Conti</p>
                  <p className="num mt-1 text-base font-bold text-ink">{settings.accounts_count}</p>
                </div>
                <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                  <p className="label">Movimenti</p>
                  <p className="num mt-1 text-base font-bold text-ink">{settings.transactions_count}</p>
                </div>
                <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                  <p className="label">Dimensione</p>
                  <p className="num mt-1 text-base font-bold text-ink">
                    {formatNumber(settings.database_size_kb, 0)} <span className="text-[10px] font-medium text-muted">KB</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  icon={<Download className="h-4 w-4" />}
                  loading={exporting === 'csv'}
                  onClick={() => handleExport('csv')}
                >
                  Esporta movimenti in CSV
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  icon={<FileJson className="h-4 w-4" />}
                  loading={exporting === 'json'}
                  onClick={() => handleExport('json')}
                >
                  Scarica backup completo JSON
                </Button>
              </div>
            </>
          )}

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            Nessun dato lascia il dispositivo. Il backend usa SQLite e salva tutto nella cartella
            <code className="mx-1 rounded bg-surface-2 px-1 py-0.5 text-[10px]">backend/data</code>.
          </p>
        </section>
      </div>

      <section className="card card-pad border-danger/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-danger">
              <Trash2 className="h-4 w-4" />
              <h2 className="text-[15px] font-bold">Zona pericolosa</h2>
            </div>
            <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">
              Azzera conti, movimenti, budget, ricorrenze e obiettivi per ripartire da zero. L'account
              e le categorie predefinite rimangono.
            </p>
          </div>
          <Button variant="danger" onClick={() => setResetOpen(true)}>
            Azzera tutti i dati
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-[11px] text-muted">
        <p className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Saldo {settings?.version ?? '1.0.0'} · API FastAPI + SQLite · Creato per le tue finanze
        </p>
        <p className="flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5" />
          I tuoi dati, a casa tua.
        </p>
      </div>

      <ResetDataModal open={resetOpen} onClose={() => setResetOpen(false)} />
    </div>
  )
}
