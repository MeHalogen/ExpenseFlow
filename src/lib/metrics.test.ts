import { describe, it, expect } from 'vitest'
import { computeMetrics } from './metrics'
import { Expense } from '@/types'

const mk = (p: Partial<Expense>): Expense => ({
  id: Math.random().toString(), amount: 0, category: '', mode: 'UPI', bank: 'ICICI',
  note: '', date: '2026-07-01', created_at: '', type: 'expense', subcategory: '',
  merchant: '', status: 'confirmed', recurringId: '', rawSms: '', ...p,
})

describe('computeMetrics', () => {
  it('separates income, consumption, and investment', () => {
    const m = computeMetrics([
      mk({ type: 'income', amount: 122000, bank: 'ICICI' }),
      mk({ type: 'expense', amount: 450, bank: 'IDBI' }),
      mk({ type: 'expense', amount: 300, bank: 'Cash' }),
      mk({ type: 'investment', amount: 16000, bank: 'ICICI' }),
    ])
    expect(m.moneyIn).toBe(122000)
    expect(m.consumption).toBe(750)
    expect(m.sipTotal).toBe(16000)
    expect(m.netSaved).toBe(121250)
  })
  it('computes source split of consumption', () => {
    const m = computeMetrics([
      mk({ type: 'expense', amount: 750, bank: 'Cash' }),
      mk({ type: 'expense', amount: 250, bank: 'ICICI' }),
    ])
    expect(m.dadCashSpent).toBe(750)
    expect(m.ownMoneySpent).toBe(250)
    expect(m.sourceSplitPct.dad).toBe(75)
    expect(m.sourceSplitPct.own).toBe(25)
  })
  it('ignores pending rows in money figures', () => {
    const m = computeMetrics([mk({ type: 'expense', amount: 999, status: 'pending' })])
    expect(m.consumption).toBe(0)
  })
  it('handles empty input', () => {
    const m = computeMetrics([])
    expect(m.sourceSplitPct).toEqual({ dad: 0, own: 0 })
  })
})
