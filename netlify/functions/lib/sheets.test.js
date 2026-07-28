import { describe, it, expect } from 'vitest'
import { HEADERS, getTabName, rowToExpense, expenseToRow } from './sheets.js'

describe('sheets helper', () => {
  it('has 14 headers in canonical order', () => {
    expect(HEADERS).toEqual([
      'id','amount','category','mode','bank','note','date','created_at',
      'type','subcategory','merchant','status','recurringId','rawSms',
    ])
  })
  it('names monthly tab as MMM yyyy', () => {
    expect(getTabName('2026-07-15')).toBe('Jul 2026')
  })
  it('defaults legacy 8-col rows to expense/confirmed', () => {
    const e = rowToExpense(['1','450','Food','UPI','IDBI','lunch','2026-07-01','2026-07-01T00:00:00Z'])
    expect(e.type).toBe('expense')
    expect(e.status).toBe('confirmed')
    expect(e.subcategory).toBe('')
    expect(e.bank).toBe('IDBI')
  })
  it('round-trips through expenseToRow', () => {
    const row = expenseToRow({ id:'2', amount:69, category:'Bills', mode:'Auto', bank:'ICICI',
      note:'', date:'2026-07-01', created_at:'x', type:'expense', subcategory:'Apple Music',
      merchant:'Apple', status:'confirmed', recurringId:'applemusic', rawSms:'' })
    expect(row).toHaveLength(14)
    expect(row[8]).toBe('expense')
    expect(row[9]).toBe('Apple Music')
    expect(rowToExpense(row).recurringId).toBe('applemusic')
  })
})
