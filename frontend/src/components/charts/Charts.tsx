import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  BudgetHistoryPoint,
  CategorySlice,
  ForecastMonth,
  MonthPoint,
  NetWorthPoint,
  PayeeMonthlyPoint,
  WeekdaySpendPoint,
} from '../../types'
import { formatCompactCurrency, formatCurrency, formatPercent } from '../../lib/format'

interface TooltipItem {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipItem[]
  label?: string
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow-float)]">
      {label ? <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={`${item.dataKey ?? item.name ?? index}`} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? 'var(--accent)' }} />
              {item.name}
            </span>
            <span className="num text-xs font-semibold text-ink">
              {formatCurrency(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const gridProps = {
  stroke: 'var(--line)',
  strokeDasharray: '3 5',
  vertical: false,
} as const

const axisTick = { fill: 'var(--muted)', fontSize: 11 } as const

export function CashflowChart({ data, height = 270 }: { data: MonthPoint[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#F97316" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tickFormatter={(value: string) => value.split(' ')[0]}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 4' }} />
          <Area
            type="monotone"
            dataKey="income"
            name="Entrate"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#incomeGradient)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Uscite"
            stroke="#F97316"
            strokeWidth={2}
            fill="url(#expenseGradient)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function NetWorthChart({ data, height = 260 }: { data: NetWorthPoint[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tickFormatter={(value: string) => value.split(' ')[0]}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            name="Patrimonio"
            stroke="var(--accent)"
            strokeWidth={2.4}
            fill="url(#netWorthGradient)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface CategoryDonutProps {
  data: CategorySlice[]
  total: number
  height?: number
  label?: string
}

export function CategoryDonut({ data, total, height = 220, label = 'Spese' }: CategoryDonutProps) {
  const visible = data.filter((item) => item.amount > 0).slice(0, 8)
  return (
    <div className="relative" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={visible}
            dataKey="amount"
            nameKey="name"
            innerRadius="66%"
            outerRadius="92%"
            paddingAngle={2.5}
            cornerRadius={5}
            stroke="none"
          >
            {visible.map((item) => (
              <Cell key={item.name} fill={item.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null
              const item = payload[0].payload as CategorySlice
              return (
                <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-float)]">
                  <p className="text-xs font-semibold text-ink">{item.name}</p>
                  <p className="num mt-0.5 text-xs text-muted">
                    {formatCurrency(item.amount)} · {formatPercent(item.percentage)}
                  </p>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
        <span className="num mt-1 font-display text-xl font-extrabold text-ink">{formatCurrency(total)}</span>
      </div>
      {visible.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-32 rounded-full border-[10px] border-surface-2" />
        </div>
      ) : null}
    </div>
  )
}

export function ForecastChart({ data, height = 220 }: { data: ForecastMonth[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tickFormatter={(value: string) => value.split(' ')[0]}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar dataKey="income" name="Entrate" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Bar dataKey="expense" name="Uscite" fill="#F97316" radius={[6, 6, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MonthlyBars({ data, height = 260 }: { data: MonthPoint[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tickFormatter={(value: string) => value.split(' ')[0]}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar dataKey="income" name="Entrate" fill="var(--accent)" radius={[5, 5, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expense" name="Uscite" fill="#F97316" radius={[5, 5, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BudgetHistoryChart({ data, height = 260 }: { data: BudgetHistoryPoint[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tickFormatter={(value: string) => value.split(' ')[0]}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar dataKey="total_budget" name="Budget" fill="var(--line-strong)" radius={[5, 5, 0, 0]} maxBarSize={24} />
          <Bar dataKey="total_spent" name="Speso" fill="var(--accent)" radius={[5, 5, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WeekdayChart({ data, height = 230 }: { data: WeekdaySpendPoint[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar dataKey="amount" name="Spese" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PayeeMonthlyBars({ data, height = 220 }: { data: PayeeMonthlyPoint[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value: string) => value.split(' ')[0]}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar dataKey="amount" name="Spese" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
