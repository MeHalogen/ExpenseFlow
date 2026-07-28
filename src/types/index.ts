export type PaymentMode = 'UPI' | 'Card' | 'Cash' | 'Auto'
export type TxType = 'income' | 'expense' | 'investment'
export type Account = 'ICICI' | 'IDBI' | 'Cash'
export type Status = 'pending' | 'confirmed'

export type Expense = {
  id: string
  amount: number
  category: string
  mode: PaymentMode
  bank: string
  note: string
  date: string
  created_at: string
  type: TxType
  subcategory: string
  merchant: string
  status: Status
  recurringId: string
  rawSms: string
}
export type ExpenseInput = Omit<Expense, 'id' | 'created_at'>

export type RecurringItem = { id: string; label: string; type: TxType; amount: number; bank: string; category: string; subcategory: string; variable: boolean; active: boolean }
export type Rule = { keyword: string; category: string; subcategory: string }
export type TaxonomyRow = { category: string; subcategory: string }
export type Config = { recurring: RecurringItem[]; rules: Rule[]; taxonomy: TaxonomyRow[] }
