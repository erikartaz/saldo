import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { AppIcon } from '../../lib/icons'
import { formatPercent } from '../../lib/format'
import { cn, ICON_OPTIONS, monthLabel, PALETTE, clamp } from '../../lib/utils'
import { Button, IconButton } from './Button'

type BadgeVariant = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'lime'

const BADGE_STYLES: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  success: 'bg-accent-soft text-accent-ink border-accent/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  info: 'bg-info-soft text-info border-info/20',
  accent: 'bg-accent text-on-accent border-transparent',
  lime: 'bg-lime text-[#142019] border-transparent',
}

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  color?: string
  className?: string
}

export function Badge({ children, variant = 'neutral', color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        BADGE_STYLES[variant],
        className,
      )}
      style={color ? { backgroundColor: `${color}1f`, color, borderColor: `${color}33` } : undefined}
    >
      {children}
    </span>
  )
}

interface ProgressProps {
  value: number
  tone?: 'auto' | 'accent' | 'warning' | 'danger'
  className?: string
  size?: 'sm' | 'md'
}

export function Progress({ value, tone = 'auto', className, size = 'md' }: ProgressProps) {
  const percentage = clamp(value, 0, 100)
  const resolvedTone =
    tone !== 'auto' ? tone : percentage >= 100 ? 'danger' : percentage >= 80 ? 'warning' : 'accent'
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-surface-3', size === 'sm' ? 'h-1.5' : 'h-2.5', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          resolvedTone === 'accent' && 'bg-accent',
          resolvedTone === 'warning' && 'bg-warning',
          resolvedTone === 'danger' && 'bg-danger',
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <div className={cn('grid place-items-center rounded-2xl bg-surface-2 text-muted', compact ? 'h-10 w-10' : 'h-14 w-14')}>
        <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} strokeWidth={1.6} />
      </div>
      <h3 className={cn('font-semibold text-ink', compact ? 'mt-3 text-sm' : 'mt-4 text-base')}>{title}</h3>
      {description ? (
        <p className={cn('max-w-sm text-muted', compact ? 'mt-1 text-xs' : 'mt-1.5 text-[13px]')}>{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-accent', className)} />
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Spinner className="h-7 w-7" />
      <p className="text-sm text-muted">Caricamento…</p>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  fullWidth?: boolean
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  fullWidth = false,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex rounded-xl border border-line bg-surface-2 p-1',
        fullWidth && 'flex w-full',
        className,
      )}
      role="tablist"
    >
      {options.map((option) => {
        const Icon = option.icon
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition',
              fullWidth && 'flex-1',
              size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-[13px]',
              active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {Icon ? <Icon className="h-4 w-4" strokeWidth={1.9} /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label?: string
}

export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}

export function ToggleRow({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
      <div>
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return (
    <div
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink',
        className,
      )}
    >
      {initials || 'S'}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  hint?: ReactNode
  delta?: number | null
  positiveIsGood?: boolean
  featured?: boolean
  compact?: boolean
  className?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  positiveIsGood = true,
  featured = false,
  compact = false,
  className,
}: StatCardProps) {
  const hasDelta = delta !== undefined && delta !== null
  const positive = (delta ?? 0) >= 0
  const good = positive === positiveIsGood

  if (featured) {
    return (
      <div className={cn('hero-card flex flex-col justify-between rounded-3xl p-5 sm:p-6', className)}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white/60">{label}</span>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[#d9f99d]">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
        </div>
        <p className="num mt-4 font-display text-[26px] font-extrabold leading-none tracking-tight text-white sm:text-[32px]">
          {value}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {hasDelta ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold',
                good ? 'text-[#d9f99d]' : 'text-[#fecaca]',
              )}
            >
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {formatPercent(Math.abs(delta ?? 0))}
            </span>
          ) : null}
          {hint ? <span className="text-[11px] text-white/55">{hint}</span> : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'card flex flex-col justify-between',
        compact ? 'rounded-2xl p-3' : 'p-4 sm:p-6',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('label', compact && 'text-[9px] tracking-[0.06em]')}>{label}</span>
        {!compact ? (
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          'num font-display font-bold leading-none tracking-tight text-ink',
          compact ? 'mt-2 text-[15px]' : 'mt-3 text-[20px] sm:text-[24px] xl:text-[26px]',
        )}
      >
        {value}
      </p>
      <div className={cn('flex flex-wrap items-center gap-2', compact ? 'mt-1.5 gap-1' : 'mt-3')}>
        {hasDelta ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full font-semibold',
              compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[11px]',
              good ? 'bg-accent-soft text-accent-ink' : 'bg-danger-soft text-danger',
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {formatPercent(Math.abs(delta ?? 0))}
          </span>
        ) : null}
        {hint ? (
          <span className={cn('text-muted', compact ? 'text-[9.5px]' : 'text-[11px]')}>{hint}</span>
        ) : null}
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  eyebrow?: string
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="label mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-[32px]">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function MonthPicker({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (month: string) => void
  className?: string
}) {
  const shift = (delta: number) => {
    const [year, month] = value.split('-').map(Number)
    const date = new Date(year, month - 1 + delta, 1)
    onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1', className)}>
      <IconButton label="Mese precedente" onClick={() => shift(-1)} className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </IconButton>
      <span className="min-w-[7.5rem] px-1 text-center text-[13px] font-semibold text-ink">{monthLabel(value)}</span>
      <IconButton label="Mese successivo" onClick={() => shift(1)} className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </IconButton>
    </div>
  )
}

export function TrendPill({ value, positiveIsGood = true }: { value: number | null; positiveIsGood?: boolean }) {
  if (value === null) {
    return <span className="text-[11px] text-muted">—</span>
  }
  const positive = value >= 0
  const good = positive === positiveIsGood
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        good ? 'bg-accent-soft text-accent-ink' : 'bg-danger-soft text-danger',
      )}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {formatPercent(Math.abs(value))}
    </span>
  )
}

function isLightColor(hex: string): boolean {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}

interface ColorIconPickerProps {
  color: string
  icon: string
  onColorChange: (color: string) => void
  onIconChange: (icon: string) => void
  className?: string
}

export function ColorIconPicker({
  color,
  icon,
  onColorChange,
  onIconChange,
  className,
}: ColorIconPickerProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <p className="mb-2 text-[13px] font-medium text-ink">Colore</p>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`Colore ${option}`}
              onClick={() => onColorChange(option)}
              className={cn(
                'grid h-7 w-7 place-items-center rounded-full transition hover:scale-110',
              )}
              style={{
                backgroundColor: option,
                ...(color.toLowerCase() === option.toLowerCase()
                  ? { boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${option}` }
                  : {}),
              }}
            >
              {color.toLowerCase() === option.toLowerCase() ? (
                <Check className={cn('h-3.5 w-3.5', isLightColor(option) ? 'text-[#122019]' : 'text-white')} strokeWidth={3} />
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-medium text-ink">Icona</p>
        <div className="grid grid-cols-8 gap-1.5">
          {ICON_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`Icona ${option}`}
              onClick={() => onIconChange(option)}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-lg border transition',
                icon === option
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-line bg-surface-2 text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              <AppIcon name={option} className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SectionTitle({
  title,
  action,
  subtitle,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}
