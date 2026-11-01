import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  PieChart,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../lib/api'
import type { AuthStatus } from '../types'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Button } from '../components/ui/Button'
import { Field, FormError, Input } from '../components/ui/Field'
import { Badge } from '../components/ui/Primitives'

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Wallet,
    title: 'Tutti i conti, un unico saldo',
    text: 'Conti correnti, risparmi, carte e contanti sempre allineati.',
  },
  {
    icon: PieChart,
    title: 'Budget che parlano chiaro',
    text: 'Sai subito quanto hai speso e quanto ti resta per categoria.',
  },
  {
    icon: Target,
    title: 'Obiettivi e previsioni',
    text: 'Pianifica le ricorrenze e guarda dove stanno andando i tuoi soldi.',
  },
]

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid h-10 w-10 place-items-center rounded-[13px] bg-[#C8F169] font-display text-[21px] font-extrabold text-[#0B3F31]">
        S
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#C8F169] ring-2 ring-[#0B3F31]" />
      </span>
      <span className="font-display text-[24px] font-extrabold tracking-tight text-white">
        saldo<span className="text-[#C8F169]">.</span>
      </span>
    </div>
  )
}

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#06251d] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(90% 80% at 100% 0%, rgba(22,116,91,0.55) 0%, rgba(6,37,29,0) 58%), radial-gradient(60% 60% at 0% 100%, rgba(200,241,105,0.12) 0%, rgba(6,37,29,0) 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(70% 60% at 50% 40%, black, transparent)',
        }}
      />

      <div className="relative">
        <BrandMark />
      </div>

      <div className="relative mt-16 max-w-xl">
        <Badge variant="lime" className="gap-1.5 bg-[#C8F169]/15 text-[#D9F99D]">
          <Sparkles className="h-3 w-3" />
          Finanze personali, senza rumore
        </Badge>
        <h1 className="mt-5 font-display text-[46px] font-extrabold leading-[1.03] tracking-tight xl:text-[58px]">
          Le tue finanze,
          <br />
          <span className="text-[#C8F169]">finalmente chiare.</span>
        </h1>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
          Conti, movimenti, budget, ricorrenze e obiettivi in un unico posto. Un'app privata,
          veloce e progettata per essere letta a colpo d'occhio.
        </p>

        <div className="mt-9 space-y-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <div key={feature.title} className="flex items-start gap-3.5">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-[#C8F169]">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{feature.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/50">{feature.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="relative mt-12 max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
              Patrimonio netto
            </span>
            <Badge variant="lime" className="bg-[#C8F169]/15 text-[#D9F99D]">
              anteprima
            </Badge>
          </div>
          <div className="mt-2 flex items-end justify-between gap-4">
            <p className="num font-display text-[30px] font-extrabold tracking-tight text-white">
              € 24.860,00
            </p>
            <div className="flex h-11 items-end gap-1.5">
              {[38, 55, 44, 68, 60, 82, 74].map((height, index) => (
                <span
                  key={index}
                  className="w-2.5 rounded-full bg-gradient-to-t from-[#3DDBA4]/25 to-[#C8F169]"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 border-t border-white/10 pt-3 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C8F169]" /> Entrate +€ 3.240
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" /> Uscite −€ 1.870
            </span>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-white/35">
          <ShieldCheck className="h-3.5 w-3.5" />
          I dati restano nel database SQLite sul tuo computer.
        </p>
      </div>
    </div>
  )
}

function IconInput({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <Input className="pl-10" {...props} />
    </div>
  )
}

export function AuthPage() {
  const navigate = useNavigate()
  const { login, setup } = useAuth()
  const { resolved, toggle } = useTheme()

  const statusQuery = useQuery({
    queryKey: ['auth-status'],
    queryFn: () => api.get<AuthStatus>('/auth/status'),
    retry: 1,
  })

  const [mode, setMode] = useState<'login' | 'setup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (statusQuery.data?.needs_setup) setMode('setup')
  }, [statusQuery.data])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (mode === 'setup' && !name.trim()) {
      setError('Inserisci il tuo nome')
      return
    }
    if (!email.includes('@')) {
      setError('Inserisci un indirizzo email valido')
      return
    }
    if (password.length < 8) {
      setError('La password deve contenere almeno 8 caratteri')
      return
    }
    if (mode === 'setup' && password !== confirm) {
      setError('Le due password non coincidono')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'setup') {
        await setup(name.trim(), email.trim(), password)
      } else {
        await login(email.trim(), password)
      }
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Accesso non riuscito')
    } finally {
      setSubmitting(false)
    }
  }

  if (statusQuery.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <div className="flex flex-col items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0B3F31] font-display text-2xl font-extrabold text-[#C8F169]">
            S
          </div>
          <div className="h-1 w-28 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
          </div>
        </div>
      </div>
    )
  }

  if (statusQuery.isError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-ink">Server non raggiungibile</h1>
          <p className="mt-2 text-sm text-muted">
            Non riesco a contattare il backend. Avvia l'API con <code className="rounded bg-surface-2 px-1">uv run uvicorn app.main:app</code> e riprova.
          </p>
          <Button className="mt-5" onClick={() => statusQuery.refetch()}>
            Riprova
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <div className="relative flex min-h-dvh flex-col px-5 py-6 sm:px-8 lg:min-h-0 lg:justify-center lg:px-12 xl:px-20">
        <div className="flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#0B3F31] font-display text-lg font-extrabold text-[#C8F169]">
              S
            </span>
            <span className="font-display text-[21px] font-extrabold tracking-tight text-ink">
              saldo<span className="text-accent">.</span>
            </span>
          </div>
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted"
          >
            {resolved === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10 lg:py-0">
          <div className="hidden justify-end lg:flex">
            <button
              type="button"
              onClick={toggle}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              {resolved === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
            </button>
          </div>

          <div className="mt-4 lg:mt-8">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {mode === 'setup' ? 'Primo accesso' : 'Bentornato'}
            </p>
            <h1 className="mt-3 text-[30px] font-extrabold leading-tight tracking-tight text-ink sm:text-[34px]">
              {mode === 'setup' ? 'Crea il tuo spazio finanziario' : 'Accedi a Saldo'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {mode === 'setup'
                ? 'Bastano pochi secondi. I dati restano sul tuo dispositivo.'
                : 'Inserisci le credenziali per riprendere da dove avevi lasciato.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error ? <FormError message={error} /> : null}

            {mode === 'setup' ? (
              <Field label="Nome" htmlFor="name">
                <IconInput
                  id="name"
                  icon={User}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Come ti chiami?"
                  autoComplete="name"
                />
              </Field>
            ) : null}

            <Field label="Email" htmlFor="email">
              <IconInput
                id="email"
                icon={Mail}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@esempio.it"
                autoComplete="email"
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              hint={mode === 'setup' ? 'Almeno 8 caratteri' : undefined}
            >
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'setup' ? 'Almeno 8 caratteri' : 'La tua password'}
                  autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
                  className="pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition hover:bg-surface-3 hover:text-ink"
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {mode === 'setup' ? (
              <Field label="Conferma password" htmlFor="confirm">
                <IconInput
                  id="confirm"
                  icon={Lock}
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Ripeti la password"
                  autoComplete="new-password"
                />
              </Field>
            ) : null}

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              {mode === 'setup' ? 'Crea account' : 'Accedi'}
              {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>
              La password è protetta con Argon2 e i dati sono salvati in un database SQLite locale.
              Nessun servizio esterno, nessun tracciamento.
            </p>
          </div>

          {statusQuery.data && !statusQuery.data.needs_setup && mode === 'setup' ? (
            <p className="mt-6 text-center text-xs text-muted">
              Hai già configurato un account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                }}
                className="font-semibold text-accent-ink underline-offset-2 hover:underline"
              >
                Accedi
              </button>
            </p>
          ) : null}
        </div>

        <p className="mt-8 text-center text-[11px] text-muted/70 lg:mt-0">Saldo 1.0 · Made for your money</p>
      </div>
    </div>
  )
}
