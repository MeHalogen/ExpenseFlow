import { useState } from 'react'
import { toast } from 'sonner'
import { Expense } from '@/types'
import { currency } from '@/lib/utils'

interface Props {
  onSubmit: (text: string) => Promise<{ status: string; expense?: Expense }>
}

export function PasteSmsBox({ onSubmit }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const capture = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      const res = await onSubmit(text.trim())
      if (res.status === 'duplicate') toast('Already captured')
      else if (res.status === 'ignored') { toast('Reminder — not logged'); setText('') }
      else if (res.expense && res.expense.amount > 0) { toast.success(`Captured ${currency(res.expense.amount)} → Inbox`); setText('') }
      else toast.warning("Couldn't read the amount — check the Inbox")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Capture failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl bg-surface border border-border p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Paste a bank SMS</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder="Paste the message here…"
        className="w-full rounded-lg bg-ink border border-border px-3 py-2 text-[13px] text-white placeholder:text-muted outline-none focus:border-primary/60 resize-none" />
      <button onClick={capture} disabled={busy}
        className="pressable w-full h-10 rounded-lg bg-primary text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Capturing…' : 'Capture to Inbox'}
      </button>
    </div>
  )
}
