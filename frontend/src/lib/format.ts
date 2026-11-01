const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
})

const signedFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
  useGrouping: true,
})

export function formatCurrency(value: number, options?: { sign?: boolean; decimals?: number }): string {
  if (options?.sign) {
    return signedFormatter.format(value)
  }
  if (options?.decimals !== undefined) {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: options.decimals,
      maximumFractionDigits: options.decimals,
      useGrouping: true,
    }).format(value)
  }
  return currencyFormatter.format(value)
}

/** Formats a positive stored amount with the sign that matches its movement type. */
export function formatSignedAmount(value: number, type: 'income' | 'expense' | 'transfer'): string {
  if (type === 'transfer') return formatCurrency(value)
  return formatCurrency(type === 'income' ? value : -value, { sign: true })
}

export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} M€`
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k€`
  }
  return `${sign}${Math.round(abs)}€`
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString('it-IT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

export function formatDate(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateShort(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
  })
}

export function formatDateLong(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function relativeDay(dateISO: string): string {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`
  if (dateISO === todayKey) return 'Oggi'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(
    yesterday.getDate(),
  ).padStart(2, '0')}`
  if (dateISO === yesterdayKey) return 'Ieri'
  return formatDate(dateISO)
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('it-IT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  })
}
