import { Expense } from '@/types'
import { AnalyticsCharts } from '@/components/ChartsPanel'

export function AnalyticsPage({ expenses }: { expenses: Expense[] }) {
  return (
    <div className="space-y-8 pb-4 pt-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Analytics</h2>
        <p className="text-sm text-muted mt-0.5">Trend, category & bank breakdown.</p>
      </div>
      {expenses.length === 0 ? (
        <p className="text-sm text-muted py-10 text-center">Add expenses to see analytics.</p>
      ) : (
        <AnalyticsCharts expenses={expenses} />
      )}
    </div>
  )
}
