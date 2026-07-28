import { useMemo } from 'react'
import { parseISO, startOfMonth } from 'date-fns'
import { Expense } from '@/types'
import { currency } from '@/lib/utils'
import { CategoryDonut } from '@/components/ChartsPanel'
import { TransactionList } from '@/components/TransactionList'
import { DashboardHero } from '@/components/DashboardHero'

interface Props {
  expenses: Expense[]
  metrics: Parameters<typeof DashboardHero>[0]['metrics']
  dailyAverage: number
  onDelete: (id: string) => void
}

export function HomePage({ expenses, metrics, dailyAverage, onDelete }: Props) {
  const topCategory = useMemo(() => {
    const counts = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {})
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  }, [expenses])

  const topMode = useMemo(() => {
    const counts = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.mode] = (acc[e.mode] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  }, [expenses])

  const thisMonthExpenses = useMemo(() => {
    const monthStart = startOfMonth(new Date())
    return expenses.filter((e) => parseISO(e.date) >= monthStart)
  }, [expenses])

  return (
    <div className="space-y-8 pb-4">

      {/* ── Hero ─────────────────────────────────────── */}
      <DashboardHero metrics={metrics} />

      {/* ── Inline stats ─────────────────────────────── */}
      <section>
        <div className="flex items-stretch divide-x divide-border">
          <div className="flex-1 pr-4">
            <p className="text-[11px] text-muted mb-1 uppercase tracking-wider">Daily Avg</p>
            <p className="tabular text-base font-semibold text-white">{currency(dailyAverage)}</p>
          </div>
          <div className="flex-1 px-4">
            <p className="text-[11px] text-muted mb-1 uppercase tracking-wider">Top Category</p>
            <p className="text-base font-semibold text-white">{topCategory}</p>
          </div>
          <div className="flex-1 pl-4">
            <p className="text-[11px] text-muted mb-1 uppercase tracking-wider">Top Mode</p>
            <p className="text-base font-semibold text-white">{topMode}</p>
          </div>
        </div>
      </section>

      {/* ── Category breakdown ───────────────────────── */}
      {thisMonthExpenses.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-4">Spending by Category</p>
          <CategoryDonut expenses={thisMonthExpenses} />
        </section>
      )}

      {/* ── Recent transactions ──────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Recent</p>
          <p className="text-[11px] text-muted">Last {Math.min(5, expenses.length)}</p>
        </div>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">No expenses yet. Tap + to add one.</p>
        ) : (
          <TransactionList expenses={expenses.slice(0, 5)} onDelete={onDelete} />
        )}
      </section>

    </div>
  )
}
