import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { Config, Expense, ExpenseInput } from '@/types'
import { defaultBanks } from '@/lib/constants'
import { fetchExpenses, createExpense, destroyExpense, fetchConfig, ingestSms, updateExpense as apiUpdate, ensureRecurring } from '@/lib/api'
import { computeMetrics } from '@/lib/metrics'

const LOCAL_KEY = 'expenseflow-cache-v1'
const PREF_KEY  = 'expenseflow-prefs-v1'

export function useExpenseStore() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [banks, setBanks]       = useState<string[]>(defaultBanks)
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false) // background sync indicator
  const [error, setError]       = useState<string | null>(null)
  const [config, setConfig]     = useState<Config>({ recurring: [], rules: [], taxonomy: [] })

  // ── 1. Hydrate from localStorage immediately (instant paint) ──────────
  useEffect(() => {
    const cached = localStorage.getItem(LOCAL_KEY)
    const prefs  = localStorage.getItem(PREF_KEY)

    setExpenses(cached ? JSON.parse(cached) : [])
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

    fetchConfig().then(setConfig).catch((e) => console.warn('[config]', e.message))
    const monthKey = format(new Date(), 'yyyy-MM')
    if (localStorage.getItem('expenseflow-recurring-ran') !== monthKey) {
      ensureRecurring(monthKey)
        .then(() => { localStorage.setItem('expenseflow-recurring-ran', monthKey); return fetchExpenses() })
        .then((remote) => { setExpenses(remote); localStorage.setItem(LOCAL_KEY, JSON.stringify(remote)) })
        .catch((e) => console.warn('[ensure-recurring]', e.message))
    }
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

  const monthMetrics = useMemo(() => computeMetrics(thisMonthExp), [thisMonthExp])

  const todaySpend = expenses
    .filter((e) => e.date === format(new Date(), 'yyyy-MM-dd'))
    .reduce((s, e) => s + e.amount, 0)

  const insight = dailyAverage > 0
    ? `You spent ${Math.round((todaySpend / dailyAverage) * 100)}% of your daily average today`
    : 'Start adding expenses to unlock insights'

  // ── Monthly breakdown (last 6 months) ────────────────────────────────
  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; total: number; expenses: typeof expenses }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(new Date(), i))
      const end   = startOfMonth(subMonths(new Date(), i - 1))
      const label = format(start, 'MMM yyyy')
      const key   = format(start, 'yyyy-MM')
      const monthExpenses = expenses.filter((e) => {
        const d = parseISO(e.date)
        return d >= start && d < end
      })
      const total = monthExpenses.reduce((s, e) => s + e.amount, 0)
      months.push({ key, label, total, expenses: monthExpenses })
    }
    return months
  }, [expenses])

  // ── Confirm expense (patch + optional rule learning) ─────────────────
  const confirmExpense = async (id: string, patch: Partial<Expense>, learnRule?: { keyword: string; category: string; subcategory: string }) => {
    setExpenses((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      return next
    })
    try { await apiUpdate(id, patch, learnRule) }
    catch (err) { console.error('[confirmExpense]', err); setError('Update failed — will retry on refresh') }
  }

  // ── Submit SMS for ingestion ──────────────────────────────────────────
  const submitSms = async (text: string) => {
    const secret = import.meta.env.VITE_INGEST_SECRET as string
    const res = await ingestSms(text, secret)
    if (res.expense) {
      setExpenses((prev) => {
        const next = [res.expense as Expense, ...prev]
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
        return next
      })
    }
    return res
  }

  return {
    expenses, banks, loading, syncing, error,
    smartDefaults, totalThisMonth, lastMonthTotal, dailyAverage, todaySpend, insight,
    monthlyData, monthMetrics,
    config,
    pending: expenses.filter((e) => e.status === 'pending'),
    addExpense, deleteExpense, setBanks,
    confirmExpense, submitSms,
  }
}
