import { currency } from '@/lib/utils'

interface Metrics {
  moneyIn: number; consumption: number; sipTotal: number; netSaved: number
  dadCashSpent: number; ownMoneySpent: number; sourceSplitPct: { dad: number; own: number }
}

export function DashboardHero({ metrics: m }: { metrics: Metrics }) {
  return (
    <section className="space-y-6 pt-4">
      <div>
        <p className="text-sm text-muted mb-1">Spent this month</p>
        <h2 className="tabular text-5xl font-bold tracking-tight leading-none text-white">
          {currency(m.consumption)}
        </h2>
        {m.sipTotal > 0 && (
          <p className="text-xs text-muted mt-2">+ {currency(m.sipTotal)} to SIP · invested, not spent</p>
        )}
      </div>

      {m.consumption > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Where your spending came from</p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface flex">
            <div className="h-full bg-success" style={{ width: `${m.sourceSplitPct.dad}%` }} />
            <div className="h-full bg-primary" style={{ width: `${m.sourceSplitPct.own}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-success">Cash {m.sourceSplitPct.dad}% · {currency(m.dadCashSpent)}</span>
            <span className="text-primary">Bank {m.sourceSplitPct.own}% · {currency(m.ownMoneySpent)}</span>
          </div>
        </div>
      )}
    </section>
  )
}
