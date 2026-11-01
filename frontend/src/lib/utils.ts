import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AccountType, Frequency } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const MONTHS_LONG = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
]

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const name = style === 'long' ? MONTHS_LONG[monthNumber - 1] : MONTHS_SHORT[monthNumber - 1]
  return `${name} ${year}`
}

export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function shiftDate(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseAmount(value: string): number {
  let normalized = value.trim().replace(/\s/g, '').replace(/[^0-9.,-]/g, '')
  if (normalized.includes(',')) {
    // Italian format: dots are thousands separators, the comma is the decimal mark.
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else {
    const dots = (normalized.match(/\./g) ?? []).length
    if (dots > 1) {
      normalized = normalized.replace(/\./g, '')
    } else if (dots === 1) {
      const decimals = normalized.length - normalized.lastIndexOf('.') - 1
      // "1.500" is one thousand five hundred; "12.50" is twelve and a half.
      if (decimals === 3) normalized = normalized.replace('.', '')
    }
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

export const ACCOUNT_TYPES: Record<AccountType, { label: string; icon: string; description: string }> = {
  checking: { label: 'Conto corrente', icon: 'landmark', description: 'Il conto di tutti i giorni' },
  savings: { label: 'Risparmio', icon: 'piggy-bank', description: 'Soldi messi da parte' },
  cash: { label: 'Contanti', icon: 'banknote', description: 'Denaro contante' },
  credit_card: { label: 'Carta di credito', icon: 'credit-card', description: 'Spese con carta' },
  investment: { label: 'Investimenti', icon: 'chart-line', description: 'Titoli e fondi' },
  other: { label: 'Altro', icon: 'wallet', description: 'Un altro tipo di conto' },
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Ogni giorno',
  weekly: 'Ogni settimana',
  monthly: 'Ogni mese',
  yearly: 'Ogni anno',
}

export function frequencyLabel(frequency: Frequency, interval: number): string {
  if (interval === 1) return FREQUENCY_LABELS[frequency]
  const unit: Record<Frequency, string> = {
    daily: 'giorni',
    weekly: 'settimane',
    monthly: 'mesi',
    yearly: 'anni',
  }
  return `Ogni ${interval} ${unit[frequency]}`
}

export const PALETTE = [
  '#0E7C66',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#EC4899',
  '#F43F5E',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#64748B',
]

export const ICON_OPTIONS = [
  'wallet',
  'landmark',
  'piggy-bank',
  'banknote',
  'credit-card',
  'chart-line',
  'shopping-cart',
  'house',
  'car',
  'heart-pulse',
  'gamepad-2',
  'utensils',
  'shirt',
  'repeat',
  'graduation-cap',
  'plane',
  'briefcase',
  'gift',
  'trending-up',
  'undo-2',
  'plus-circle',
  'target',
  'tag',
  'coffee',
  'smartphone',
  'wifi',
  'dumbbell',
  'paw-print',
  'baby',
  'wrench',
  'fuel',
  'train-front',
]

export function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number)
  const [ty, tm, td] = toISO.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd)
  const to = new Date(ty, tm - 1, td)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function percentOf(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}
