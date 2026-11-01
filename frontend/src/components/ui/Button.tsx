import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'lime' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-on-accent shadow-sm hover:bg-accent-strong active:translate-y-px disabled:hover:bg-accent',
  secondary:
    'border border-line bg-surface text-ink shadow-sm hover:bg-surface-2 hover:border-line-strong active:translate-y-px',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white shadow-sm hover:opacity-90 active:translate-y-px',
  lime: 'bg-lime text-[#122019] shadow-sm hover:brightness-95 active:translate-y-px',
  outline: 'border border-accent/40 text-accent-ink hover:bg-accent-soft',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-11 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2.5 rounded-xl px-5 text-[15px]',
  icon: 'h-10 w-10 rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: 'ghost' | 'soft' | 'danger'
}

export function IconButton({ label, variant = 'ghost', className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 disabled:opacity-50',
        variant === 'ghost' && 'hover:bg-surface-2 hover:text-ink',
        variant === 'soft' && 'bg-surface-2 text-ink hover:bg-surface-3',
        variant === 'danger' && 'hover:bg-danger-soft hover:text-danger',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
