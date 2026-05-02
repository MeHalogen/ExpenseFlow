import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Expense } from '@/types'
import { categories, paymentModes } from '@/lib/constants'
import { TransactionList } from '@/components/TransactionList'

const ALL = 'All'

export function TransactionsPage({ expenses, banks, onDelete }: { expenses: Expense[]; banks: string[]; onDelete: (id: string) => void }) {
  const [query, setQuery]       = useState('')
  const [category, setCategory] = useState(ALL)
  const [mode, setMode]         = useState(ALL)

  const filtered = useMemo(() => expenses.filter((e) => {
    const q  = query ? `${e.note} ${e.category} ${e.bank}`.toLowerCase().includes(query.toLowerCase()) : true
    const c  = category !== ALL ? e.category === category : true
    const m  = mode !== ALL     ? e.mode === mode         : true
    return q && c && m
  }), [expenses, query, category, mode])

  const categoryChips = [ALL, ...categories.map((c) => c.label)]
  const modeChips     = [ALL, ...paymentModes]

  return (
    <div className="space-y-5 pb-4 pt-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Transactions</h2>
        <p className="text-sm text-muted mt-0.5">{expenses.length} total</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search note, category, bank…"
          className="w-full h-10 rounded-lg bg-surface border border-border pl-9 pr-4 text-sm text-white placeholder:text-muted outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categoryChips.map((chip) => (
          <button
            key={chip}
            onClick={() => setCategory(chip)}
            className={`pressable shrink-0 px-3 py-1 rounded-full text-[12px] font-medium border transition-colors duration-100
              ${category === chip
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-transparent border-border text-muted'}`}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Mode filter chips */}
      <div className="flex gap-2">
        {modeChips.map((chip) => (
          <button
            key={chip}
            onClick={() => setMode(chip)}
            className={`pressable shrink-0 px-3 py-1 rounded-full text-[12px] font-medium border transition-colors duration-100
              ${mode === chip
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-transparent border-border text-muted'}`}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted py-10 text-center">No transactions found.</p>
      ) : (
        <TransactionList expenses={filtered} onDelete={onDelete} />
      )}
    </div>
  )
}
