import { describe, it, expect } from 'vitest'
import { parseSms } from './sms-parser.js'

describe('parseSms', () => {
  it('parses an ICICI UPI debit', () => {
    const r = parseSms('ICICI Bank Acct XX123 debited Rs 450.00 on 15-Jul-26; Swiggy credited. UPI:5123. Call 18001080 if not you.')
    expect(r.bank).toBe('ICICI')
    expect(r.amount).toBe(450)
    expect(r.mode).toBe('UPI')
    expect(r.direction).toBe('debit')
    expect(r.merchant).toMatch(/Swiggy/i)
  })
  it('parses an IDBI card debit', () => {
    const r = parseSms('Rs.1,299.00 spent on IDBI Bank Debit Card XX987 at AMAZON on 16-Jul-26.')
    expect(r.bank).toBe('IDBI')
    expect(r.amount).toBe(1299)
    expect(r.mode).toBe('Card')
    expect(r.merchant).toMatch(/AMAZON/i)
  })
  it('detects credits (income) and does not crash', () => {
    const r = parseSms('ICICI Bank Acct XX123 credited with Rs 1,22,000.00 - Salary.')
    expect(r.direction).toBe('credit')
    expect(r.amount).toBe(122000)
  })
  it('returns nulls, never throws, on garbage', () => {
    const r = parseSms('hello world')
    expect(r.amount).toBeNull()
    expect(r.bank).toBeNull()
  })
  it('flags a future-tense reminder as isReminder', () => {
    const r = parseSms('Reminder: Rs 16,000 will be debited from your ICICI a/c for SIP on 05-Aug-26.')
    expect(r.isReminder).toBe(true)
  })
  it('flags a payment-due reminder as isReminder', () => {
    const r = parseSms('Your credit card payment of Rs 5,000 is due on 10-Aug. Pay now to avoid charges.')
    expect(r.isReminder).toBe(true)
  })
  it('does NOT flag a real completed debit as a reminder', () => {
    const r = parseSms('ICICI Bank Acct XX123 debited Rs 450.00 on 15-Jul-26; Swiggy credited. UPI:5123.')
    expect(r.isReminder).toBe(false)
    expect(r.direction).toBe('debit')
  })
})
