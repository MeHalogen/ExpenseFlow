import { Wallet, UtensilsCrossed, CarTaxiFront, ShoppingBag, Receipt, HeartPulse, Film, Car, PiggyBank, CircleDollarSign, TrendingUp } from 'lucide-react'

export const categories = [
  { label: 'Food', icon: UtensilsCrossed },
  { label: 'Travel', icon: CarTaxiFront },
  { label: 'Shopping', icon: ShoppingBag },
  { label: 'Fun', icon: Film },
  { label: 'Car', icon: Car },
  { label: 'Bills', icon: Receipt },
  { label: 'Health', icon: HeartPulse },
  { label: 'Income', icon: TrendingUp },
  { label: 'Investment', icon: PiggyBank },
  { label: 'Other', icon: CircleDollarSign },
  { label: 'General', icon: Wallet },
]
export const paymentModes = ['UPI', 'Card', 'Cash', 'Auto'] as const
export const accounts = ['ICICI', 'IDBI', 'Cash'] as const
export const txTypes = ['expense', 'income', 'investment'] as const
export const defaultBanks = ['ICICI', 'IDBI', 'Cash']
