import { format, parseISO } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { Expense } from '@/types'
import { categories } from '@/lib/constants'
import { currency } from '@/lib/utils'

const categoryColor: Record<string, string> = {
  Food:     '#F59E0B',
  Travel:   '#3B82F6',
  Shopping: '#A855F7',
  Bills:    '#EF4444',
  Health:   '#22C55E',
  Fun:      '#FB923C',
  General:  '#94A3B8',
  Other:    '#94A3B8',
}

export function TransactionList({ expenses, onDelete }: { expenses: Expense[]; onDelete: (id: string) => void }) {
  if (expenses.length === 0) return null

  return (
    <div className="divide-y divide-border">
      {expenses.map((e) => {
        const catDef  = categories.find((c) => c.label === e.category)
        const Icon    = catDef?.icon
        const color   = categoryColor[e.category] ?? '#94A3B8'

        return (
          <div key={e.id} className="pressable flex items-center gap-3 py-3.5 group">
            {/* Icon */}
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${color}18` }}
            >
              {Icon && <Icon className="size-4" style={{ color }} />}
            </div>

            {/* Meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white leading-tight">{e.category}</p>
              <p className="text-[11px] text-muted mt-0.5">
                {e.mode} · {e.bank} · {format(parseISO(e.date), 'dd MMM')}
                {e.note ? ` · ${e.note}` : ''}
              </p>
            </div>

            {/* Amount + delete */}
            <div className="flex items-center gap-3 shrink-0">
              <p className="tabular text-sm font-semibold text-white">{currency(e.amount)}</p>
              <button
                onClick={() => onDelete(e.id)}
                aria-label="Delete"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded text-muted hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
