// Frontend API client — calls Netlify Functions directly (never touches Google Sheets)

import { Expense, ExpenseInput } from '@/types'

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
