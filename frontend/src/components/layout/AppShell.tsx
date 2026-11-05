import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import {
  ArrowLeftRight,
  BarChart3,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PieChart,
  Plus,
  Repeat2,
  Settings,
  Sun,
  Tags,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { cn } from '../../lib/utils'
import { Avatar, Badge } from '../ui/Primitives'
import { Button, IconButton } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Panoramica',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/transactions', label: 'Movimenti', icon: ArrowLeftRight },
      { to: '/accounts', label: 'Conti', icon: Wallet },
    ],
  },
  {
    label: 'Pianificazione',
    items: [
      { to: '/budgets', label: 'Budget', icon: PieChart },
      { to: '/recurring', label: 'Ricorrenti', icon: Repeat2 },
      { to: '/goals', label: 'Obiettivi', icon: Flag },
      { to: '/categories', label: 'Categorie', icon: Tags },
      { to: '/payees', label: 'Beneficiari', icon: Users },
    ],
  },
  {
    label: 'Analisi',
    items: [
      { to: '/reports', label: 'Statistiche', icon: BarChart3 },
      { to: '/settings', label: 'Impostazioni', icon: Settings },
    ],
  },
]

const MOBILE_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Movimenti', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budget', icon: PieChart },
  { to: '/reports', label: 'Stats', icon: BarChart3 },
]

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <NavLink to="/" onClick={onNavigate} className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-[12px] bg-[#0B3F31] font-display text-[19px] font-extrabold text-[#C8F169] shadow-sm">
        S
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#C8F169] ring-2 ring-[#0B3F31]" />
      </span>
      <span className="font-display text-[22px] font-extrabold tracking-tight text-ink">
        saldo<span className="text-accent">.</span>
      </span>
    </NavLink>
  )
}

function Sidebar() {
  const { user, logout } = useAuth()
  const { resolved, toggle } = useTheme()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-line bg-surface/75 backdrop-blur-xl lg:flex">
      <div className="px-6 pb-6 pt-7">
        <Brand />
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-3.5 pb-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/80">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition',
                        isActive
                          ? 'bg-accent-soft text-accent-ink'
                          : 'text-muted hover:bg-surface-2 hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn('h-[18px] w-[18px]', isActive ? 'text-accent' : 'text-muted group-hover:text-ink')}
                          strokeWidth={1.9}
                        />
                        <span>{item.label}</span>
                        {isActive ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3.5">
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name ?? 'Saldo'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-[11px] text-muted">{user?.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <IconButton label={resolved === 'dark' ? 'Tema chiaro' : 'Tema scuro'} onClick={toggle} variant="ghost">
              {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </IconButton>
            <NavLink
              to="/settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-ink"
              aria-label="Impostazioni"
              title="Impostazioni"
            >
              <Settings className="h-4 w-4" />
            </NavLink>
            <div className="flex-1" />
            <IconButton label="Esci" variant="ghost" onClick={logout} className="hover:text-danger">
              <LogOut className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-muted/70">Saldo · finanze personali</p>
      </div>
    </aside>
  )
}

function Topbar() {
  const { user, logout } = useAuth()
  const { resolved, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-9">
        <div className="lg:hidden">
          <Brand />
        </div>
        <p className="hidden text-[13px] font-medium text-muted first-letter:uppercase lg:block">{today}</p>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <IconButton label="Aggiungi movimento" onClick={() => navigate('/transactions?new=1')} className="sm:hidden">
            <Plus className="h-5 w-5" />
          </IconButton>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            className="hidden sm:inline-flex"
            onClick={() => navigate('/transactions?new=1')}
          >
            Nuovo movimento
          </Button>
          <IconButton label={resolved === 'dark' ? 'Tema chiaro' : 'Tema scuro'} onClick={toggle}>
            {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </IconButton>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="ml-0.5 rounded-full ring-offset-2 ring-offset-canvas transition hover:ring-2 hover:ring-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Avatar name={user?.name ?? 'Saldo'} />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)] animate-pop-in"
              >
                <div className="border-b border-line px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                  <p className="truncate text-xs text-muted">{user?.email}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/settings')
                  }}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink transition hover:bg-surface-2"
                >
                  <Settings className="h-4 w-4 text-muted" />
                  Impostazioni
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-danger transition hover:bg-danger-soft"
                >
                  <LogOut className="h-4 w-4" />
                  Esci
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

function MobileNav() {
  const { user, logout } = useAuth()
  const { resolved, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const go = (to: string) => {
    setMenuOpen(false)
    navigate(to)
  }

  return (
    <>
      <nav
        className="fixed inset-x-3 z-40 rounded-2xl border border-line bg-surface/95 shadow-[var(--shadow-float)] backdrop-blur-xl lg:hidden"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-5 px-1 py-1.5">
          {MOBILE_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition',
                    isActive ? 'text-accent' : 'text-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.2 : 1.8} />
                    <span>{item.label}</span>
                    <span className={cn('h-1 w-1 rounded-full', isActive ? 'bg-accent' : 'bg-transparent')} />
                  </>
                )}
              </NavLink>
            )
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium text-muted"
          >
            <Menu className="h-[19px] w-[19px]" strokeWidth={1.8} />
            <span>Menu</span>
            <span className="h-1 w-1 rounded-full bg-transparent" />
          </button>
        </div>
      </nav>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" size="sm">
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
            <Avatar name={user?.name ?? 'Saldo'} className="h-11 w-11 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
            <Badge variant="success">Locale</Badge>
          </div>

          <div className="space-y-1">
            {NAV_GROUPS.flatMap((group) => group.items).map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => go(item.to)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-2"
                >
                  <Icon className="h-[18px] w-[18px] text-muted" strokeWidth={1.8} />
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-ink">
              {resolved === 'dark' ? <Moon className="h-4 w-4 text-muted" /> : <Sun className="h-4 w-4 text-muted" />}
              Tema {resolved === 'dark' ? 'scuro' : 'chiaro'}
            </span>
            <Button variant="secondary" size="sm" onClick={toggle}>
              Cambia
            </Button>
          </div>

          <Button
            variant="danger"
            className="w-full"
            icon={<LogOut className="h-4 w-4" />}
            onClick={logout}
          >
            Esci dall'account
          </Button>
        </div>
      </Modal>
    </>
  )
}

export function AppShell() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const toast = useToast()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  useEffect(() => {
    let active = true
    api
      .post<{ created: number }>('/recurring/post-due?auto_only=true')
      .then((result) => {
        if (!active || result.created === 0) return
        queryClient.invalidateQueries()
        toast.success(
          result.created === 1
            ? '1 ricorrenza registrata automaticamente'
            : `${result.created} ricorrenze registrate automaticamente`,
        )
      })
      .catch(() => {
        // Automatic posting is best-effort: the user can always register due items manually.
      })
    return () => {
      active = false
    }
    // Runs once per authenticated app session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-[264px]">
        <Topbar />
        <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:px-9 lg:pb-12">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
