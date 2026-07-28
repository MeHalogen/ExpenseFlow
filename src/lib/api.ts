// Frontend API client — calls Netlify Functions directly (never touches Google Sheets)

import { Config, Expense, ExpenseInput } from '@/types'

const FN = '/.netlify/functions'

export async function fetchExpenses(): Promise<Expense[]> {
  const res = await fetch(`${FN}/get-expenses`)
  if (!res.ok) throw new Error(`get-expenses: ${res.status}`)
  const data = await res.json()
  return data.expenses as Expense[]
}

export async function createExpense(
  input: ExpenseInput & { id: string }
): Promise<{ id: string; created_at: string }> {
  const res = await fetch(`${FN}/add-expense`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`add-expense: ${res.status}`)
  return res.json()
}

export async function destroyExpense(id: string): Promise<void> {
  const res = await fetch(`${FN}/delete-expense`, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(`delete-expense: ${res.status}`)
}

export async function fetchConfig(): Promise<Config> {
  const res = await fetch(`${FN}/get-config`)
  if (!res.ok) throw new Error(`get-config: ${res.status}`)
  return res.json()
}

export async function ingestSms(text: string, secret: string): Promise<{ status: string; expense?: Expense }> {
  const res = await fetch(`${FN}/ingest-sms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, secret }),
  })
  if (res.status === 401) throw new Error('Ingest secret rejected')
  if (!res.ok) throw new Error(`ingest-sms: ${res.status}`)
  return res.json()
}

export async function updateExpense(id: string, patch: Partial<Expense>, learnRule?: { keyword: string; category: string; subcategory: string }): Promise<{ expense: Expense }> {
  const res = await fetch(`${FN}/update-expense`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, patch, learnRule }),
  })
  if (!res.ok) throw new Error(`update-expense: ${res.status}`)
  return res.json()
}

export async function ensureRecurring(month?: string): Promise<{ created: number }> {
  const res = await fetch(`${FN}/ensure-recurring`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month }),
  })
  if (!res.ok) throw new Error(`ensure-recurring: ${res.status}`)
  return res.json()
}
