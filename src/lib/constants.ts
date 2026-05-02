import { Wallet, UtensilsCrossed, CarTaxiFront, ShoppingBag, Receipt, HeartPulse, Film, CircleDollarSign } from 'lucide-react'
export const categories = [{label:'Food',icon:UtensilsCrossed},{label:'Travel',icon:CarTaxiFront},{label:'Shopping',icon:ShoppingBag},{label:'Bills',icon:Receipt},{label:'Health',icon:HeartPulse},{label:'Fun',icon:Film},{label:'General',icon:Wallet},{label:'Other',icon:CircleDollarSign}]
export const paymentModes = ['UPI','Card','Cash'] as const
export const defaultBanks = ['HDFC','ICICI']
