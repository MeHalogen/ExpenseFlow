import { describe, it, expect } from 'vitest'
import { dedupKey } from './dedup.js'

describe('dedupKey', () => {
  it('is identical for the same amount/merchant/day', () => {
    const a = dedupKey({ amount: 450, bank: 'ICICI', merchant: 'Swiggy', date: '2026-07-15' })
    const b = dedupKey({ amount: 450, bank: 'ICICI', merchant: 'swiggy ', date: '2026-07-15' })
    expect(a).toBe(b)
  })
  it('differs when amount differs', () => {
    const a = dedupKey({ amount: 450, bank: 'ICICI', merchant: 'Swiggy', date: '2026-07-15' })
    const b = dedupKey({ amount: 451, bank: 'ICICI', merchant: 'Swiggy', date: '2026-07-15' })
    expect(a).not.toBe(b)
  })
})
