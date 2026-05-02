export type PaymentMode = 'UPI' | 'Card' | 'Cash'
export type Expense = { id: string; amount: number; category: string; mode: PaymentMode; bank: string; note: string; date: string; created_at: string }
export type ExpenseInput = Omit<Expense, 'id' | 'created_at'>
