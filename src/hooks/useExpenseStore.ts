import { useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { Expense, ExpenseInput } from '@/types'
import { defaultBanks } from '@/lib/constants'
import { fetchExpenses, createExpense, destroyExpense } from '@/lib/api'

const LOCAL_KEY = 'expenseflow-cache-v1'
const PREF_KEY  = 'expenseflow-prefs-v1'
const today     = new Date()

// Seed data shown before any remote data loads (gives instant paint)
const seed: Expense[] = [
  { id: 's1', amount: 240,  category: 'Food',     mode: 'UPI',  bank: 'HDFC',  note: 'Lunch',   date: format(today, 'yyyy-MM-dd'),              created_at: today.toISOString() },
  { id: 's2', amount: 890,  category: 'Travel',   mode: 'Card', bank: 'ICICI', note: 'Cab',     date: format(addDays(today, -1), 'yyyy-MM-dd'), created_at: addDays(today, -1).toISOString() },
  { id: 's3', amount: 1450, category: 'Shopping', mode: 'Card', bank: 'HDFC',  note: 'Shoes',   date: format(addDays(today, -2), 'yyyy-MM-dd'), created_at: addDays(today, -2).toISOString() },
  { id: 's4', amount: 320,  category: 'Food',     mode: 'UPI',  bank: 'HDFC',  note: 'Dinner',  date: format(addDays(today, -3), 'yyyy-MM-dd'), created_at: addDays(today, -3).toISOString() },
  { id: 's5', amount: 599,  category: 'Bills',    mode: 'UPI',  bank: 'ICICI', note: 'Netflix', date: format(addDays(today, -4), 'yyyy-MM-dd'), created_at: addDays(today, -4).toISOString() },
]

export function useExpenseStore() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [banks, setBanks]       = useState<string[]>(defaultBanks)
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false) // background sync indicator
  const [error, setError]       = useState<string | null>(null)

  // ── 1. Hydrate from localStorage immediately (instant paint) ──────────
  useEffect(() => {
    const cached = localStorage.getItem(LOCAL_KEY)
    const prefs  = localStorage.getItem(PREF_KEY)

    setExpenses(cached ? JSON.parse(cached) : seed)
    if (prefs) setBanks(JSON.parse(prefs).banks ?? defaultBanks)

    // ── 2. Then fetch from Google Sheets in background ──────────────────
    setSyncing(true)
    fetchExpenses()
      .then((remote) => {
        setExpenses(remote)
        localStorage.setItem(LOCAL_KEY, JSON.stringify(remote))
        setError(null)
      })
      .catch((err) => {
        console.warn('[useExpenseStore] Remote fetch failed, using cache:', err.message)
        setError('Using cached data — Google Sheets unavailable')
      })
      .finally(() => {
        setSyncing(false)
        setLoading(false)
      })
  }, [])

  // Persist bank preferences
  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify({ banks }))
  }, [banks])

  // ── Add expense ────────────────────────────────────────────────────────
  const addExpense = async (input: ExpenseInput) => {
    const id         = String(Date.now())
    const created_at = new Date().toISOString()
    const optimistic: Expense = { ...input, id, created_at }

    // Optimistic update — UI responds instantly
    setExpenses((prev) => {
      const next = [optimistic, ...prev]
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      return next
    })
    if (!banks.includes(input.bank)) setBanks((prev) => [...prev, input.bank])

    // Sync to Google Sheets
    try {
      await createExpense({ ...input, id })
    } catch (err) {
      console.error('[addExpense] Sheets sync failed:', err)
      setError('Saved locally — Sheets sync failed')
    }
  }

  // ── Delete expense ────────────────────────────────────────────────────
  const deleteExpense = async (id: string) => {
    // Optimistic remove
    setExpenses((prev) => {
      const next = prev.filter((e) => e.id !== id)
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      return next
    })

    // Sync to Google Sheets
    try {
      await destroyExpense(id)
    } catch (err) {
      console.error('[deleteExpense] Sheets sync failed:', err)
      setError('Deleted locally — Sheets sync failed')
    }
  }

  // ── Derived values ────────────────────────────────────────────────────
  const smartDefaults = useMemo(() => {
    const latest  = expenses[0]
    const counts  = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {})
    const topCat  = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Food'
    return {
      category: latest?.category ?? topCat,
      mode:     latest?.mode ?? 'UPI',
      bank:     latest?.bank ?? banks[0] ?? 'HDFC',
    }
  }, [expenses, banks])

  const monthStart      = startOfMonth(new Date())
  const lastMonthStart  = startOfMonth(subMonths(new Date(), 1))

  const thisMonthExp  = expenses.filter((e) => parseISO(e.date) >= monthStart)
  const lastMonthExp  = expenses.filter((e) => parseISO(e.date) >= lastMonthStart && parseISO(e.date) < monthStart)

  const totalThisMonth = thisMonthExp.reduce((s, e) => s + e.amount, 0)
  const lastMonthTotal = lastMonthExp.reduce((s, e) => s + e.amount, 0)
  const daysElapsed    = Math.max(1, new Date().getDate())
  const dailyAverage   = totalThisMonth / daysElapsed

  const todaySpend = expenses
    .filter((e) => e.date === format(new Date(), 'yyyy-MM-dd'))
    .reduce((s, e) => s + e.amount, 0)

  const insight = dailyAverage > 0
    ? `You spent ${Math.round((todaySpend / dailyAverage) * 100)}% of your daily average today`
    : 'Start adding expenses to unlock insights'

  return {
    expenses, banks, loading, syncing, error,
    smartDefaults, totalThisMonth, lastMonthTotal, dailyAverage, todaySpend, insight,
    addExpense, deleteExpense, setBanks,
  }
}
