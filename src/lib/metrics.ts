import { Expense } from '@/types'

export function computeMetrics(expenses: Expense[]) {
  const confirmed = expenses.filter((e) => e.status === 'confirmed')
  const sum = (pred: (e: Expense) => boolean) =>
    confirmed.filter(pred).reduce((s, e) => s + e.amount, 0)

  const moneyIn = sum((e) => e.type === 'income')
  const consumption = sum((e) => e.type === 'expense')
  const sipTotal = sum((e) => e.type === 'investment')
  const dadCashSpent = sum((e) => e.type === 'expense' && e.bank === 'Cash')
  const ownMoneySpent = consumption - dadCashSpent
  const netSaved = moneyIn - consumption

  const pct = (part: number) => (consumption > 0 ? Math.round((part / consumption) * 100) : 0)

  return {
    moneyIn, consumption, sipTotal, netSaved, dadCashSpent, ownMoneySpent,
    sourceSplitPct: { dad: pct(dadCashSpent), own: pct(ownMoneySpent) },
  }
}
