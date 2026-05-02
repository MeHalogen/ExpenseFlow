import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Home, Receipt, Plus } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { QuickAddSheet } from '@/components/QuickAddSheet'
import { useExpenseStore } from '@/hooks/useExpenseStore'
import { HomePage } from '@/pages/HomePage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { TransactionsPage } from '@/pages/TransactionsPage'

const tabs = [
  { key: 'home',         label: 'Home',         icon: Home },
  { key: 'analytics',   label: 'Analytics',    icon: BarChart3 },
  { key: 'transactions',label: 'Transactions', icon: Receipt },
] as const

export default function App() {
  const [tab, setTab] = useState<(typeof tabs)[number]['key']>('home')
  const [sheetOpen, setSheetOpen] = useState(false)

  const { expenses, banks, loading, syncing, smartDefaults, totalThisMonth, lastMonthTotal, dailyAverage, insight, monthlyData, addExpense, deleteExpense } = useExpenseStore()

  function handleDelete(id: string) { deleteExpense(id); toast.success('Deleted') }
  async function handleAdd(input: Parameters<typeof addExpense>[0]) { await addExpense(input); toast.success('Saved') }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-ink">
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{ style: { background: '#121722', border: '1px solid rgba(255,255,255,0.07)', color: '#fff', borderRadius: '10px', fontSize: '14px' } }}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 pt-8 pb-4 bg-ink">
        <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted">ExpenseFlow</p>
        {syncing && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            <span>Syncing</span>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="px-4 pb-32">
        {loading ? (
          <div className="pt-20 text-center text-sm text-muted">Loading...</div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {tab === 'home'          && <HomePage expenses={expenses} totalThisMonth={totalThisMonth} lastMonthTotal={lastMonthTotal} dailyAverage={dailyAverage} insight={insight} onDelete={handleDelete} />}
              {tab === 'analytics'     && <AnalyticsPage monthlyData={monthlyData} />}
              {tab === 'transactions'  && <TransactionsPage expenses={expenses} banks={banks} onDelete={handleDelete} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md bg-ink border-t border-border">
        <div className="flex items-center justify-around px-2 py-3 pb-safe">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pressable flex flex-col items-center gap-1 px-4 py-1 text-[11px] font-medium transition-colors duration-100
                ${tab === key ? 'text-primary' : 'text-muted'}`}
            >
              <Icon className={`size-5 ${tab === key ? 'stroke-[2px]' : 'stroke-[1.5px]'}`} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="pressable fixed bottom-20 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 transition-transform duration-100"
        aria-label="Add expense"
      >
        <Plus className="size-6 text-white stroke-[2.5px]" />
      </button>

      <QuickAddSheet open={sheetOpen} onOpenChange={setSheetOpen} banks={banks} defaults={smartDefaults} onSubmit={handleAdd} />
    </div>
  )
}
