import { describe, it, expect } from 'vitest'
import { deriveTxType } from './taxonomy'

describe('deriveTxType', () => {
  it("maps 'Income' to 'income'", () => {
    expect(deriveTxType('Income')).toBe('income')
  })

  it("maps 'Investment' to 'investment'", () => {
    expect(deriveTxType('Investment')).toBe('investment')
  })

  it("maps 'Food' to 'expense'", () => {
    expect(deriveTxType('Food')).toBe('expense')
  })

  it("maps '' to 'expense'", () => {
    expect(deriveTxType('')).toBe('expense')
  })
})
