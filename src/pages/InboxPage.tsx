import { useState } from 'react'
import { Check } from 'lucide-react'
import { Expense, Config } from '@/types'
import { currency } from '@/lib/utils'
import { buildTaxonomy, subcategoriesFor } from '@/lib/taxonomy'

interface Props {
  pending: Expense[]
  config: Config
  onConfirm: (id: string, patch: Partial<Expense>, learnRule?: { keyword: string; category: string; subcategory: string }) => Promise<void> | void
}

export function InboxPage({ pending, config, onConfirm }: Props) {
  const taxonomy = buildTaxonomy(config.taxonomy)
  const [drafts, setDrafts] = useState<Record<string, { category: string; subcategory: string }>>({})

  const draftFor = (e: Expense) => drafts[e.id] ?? { category: e.category, subcategory: e.subcategory }
  const setDraft = (id: string, d: { category: string; subcategory: string }) =>
    setDrafts((prev) => ({ ...prev, [id]: d }))

  const confirmOne = (e: Expense) => {
    const d = draftFor(e)
    const learnRule = e.merchant ? { keyword: e.merchant, category: d.category, subcategory: d.subcategory } : undefined
    onConfirm(e.id, { status: 'confirmed', category: d.category, subcategory: d.subcategory }, learnRule)
  }

  const fieldCls = 'h-9 rounded-lg bg-surface border border-border px-2 text-[13px] text-white outline-none focus:border-primary/60'

  return (
    <div className="space-y-4 pt-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Inbox</h2>
        {pending.length > 0 && (
          <button onClick={() => pending.forEach(confirmOne)}
            className="pressable rounded-lg bg-primary/15 text-primary text-xs font-semibold px-3 py-1.5">
            Confirm all ({pending.length})
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-muted py-10 text-center">Nothing to review. You're all caught up. 🎉</p>
      ) : (
        pending.map((e) => {
          const d = draftFor(e)
          return (
            <div key={e.id} className="rounded-xl bg-surface border border-border p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="tabular text-base font-semibold text-white">{currency(e.amount)}</p>
                  <p className="text-xs text-muted">{e.merchant || 'Unknown'} · {e.bank || '—'} · {e.mode}</p>
                </div>
                <button onClick={() => confirmOne(e)} aria-label="Confirm"
                  className="pressable flex size-9 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="size-4 stroke-[2.5px]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className={fieldCls} value={d.category}
                  onChange={(ev) => setDraft(e.id, { category: ev.target.value, subcategory: '' })}>
                  {taxonomy.map((t) => <option key={t.category} value={t.category} className="bg-surface">{t.category}</option>)}
                </select>
                <select className={fieldCls} value={d.subcategory}
                  onChange={(ev) => setDraft(e.id, { category: d.category, subcategory: ev.target.value })}>
                  <option value="" className="bg-surface">—</option>
                  {subcategoriesFor(taxonomy, d.category).map((s) => <option key={s} value={s} className="bg-surface">{s}</option>)}
                </select>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
