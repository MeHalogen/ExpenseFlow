import { useState } from 'react'
import { Expense } from '@/types'
import { currency } from '@/lib/utils'
import { AnalyticsCharts, MonthlyComparisonChart } from '@/components/ChartsPanel'
import { format, parseISO, startOfMonth, subMonths } from 'date-fns'

interface MonthEntry { key: string; label: string; total: number; expenses: Expense[] }

export function AnalyticsPage({ monthlyData }: { monthlyData: MonthEntry[] }) {
  // Default to current month
  const currentKey = format(startOfMonth(new Date()), 'yyyy-MM')
  const [selectedKey, setSelectedKey] = useState(currentKey)

  const selected = monthlyData.find((m) => m.key === selectedKey) ?? monthlyData[monthlyData.length - 1]
  const allExpenses = monthlyData.flatMap((m) => m.expenses)

  // Stats for selected month
  const daysInMonth = selected ? new Date(parseInt(selected.key.split('-')[0]), parseInt(selected.key.split('-')[1]), 0).getDate() : 1
  const daysPassed  = selectedKey === currentKey ? new Date().getDate() : daysInMonth
  const dailyAvg    = selected && daysPassed > 0 ? selected.total / daysPassed : 0

  const topCategory = selected?.expenses.length
    ? Object.entries(
        selected.expenses.reduce<Record<string, number>>((acc, e) => {
          acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])[0]?.[0]
    : '—'

  const activeTabs = monthlyData.filter((m) => m.total > 0 || m.key === currentKey)

  return (
    <div className="space-y-8 pb-4 pt-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Analytics</h2>
        <p className="text-sm text-muted mt-0.5">Month-on-month trends & breakdown.</p>
      </div>

      {/* Month picker */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
        {monthlyData.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelectedKey(m.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              m.key === selectedKey
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-muted hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Monthly summary stats */}
      {selected && (
        <section className="flex items-stretch divide-x divide-border">
          <div className="flex-1 pr-4">
            <p className="text-[11px] text-muted mb-1 uppercase tracking-wider">Total</p>
            <p className="tabular text-base font-semibold text-white">{currency(selected.total)}</p>
          </div>
          <div className="flex-1 px-4">
            <p className="text-[11px] text-muted mb-1 uppercase tracking-wider">Daily Avg</p>
            <p className="tabular text-base font-semibold text-white">{currency(dailyAvg)}</p>
          </div>
          <div className="flex-1 pl-4">
            <p className="text-[11px] text-muted mb-1 uppercase tracking-wider">Top Cat</p>
            <p className="text-base font-semibold text-white">{topCategory}</p>
          </div>
        </section>
      )}

      {/* Month-over-month comparison */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-4">Month-on-Month</p>
        {allExpenses.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">Add expenses to see trends.</p>
        ) : (
          <MonthlyComparisonChart data={monthlyData.map((m) => ({ label: m.label.split(' ')[0], total: m.total }))} />
        )}
      </section>

      {/* Per-month detailed charts */}
      {selected && selected.expenses.length > 0 ? (
        <AnalyticsCharts expenses={selected.expenses} />
      ) : (
        <p className="text-sm text-muted py-6 text-center">No expenses in {selected?.label}.</p>
      )}
    </div>
  )
}

