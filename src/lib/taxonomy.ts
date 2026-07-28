import { TaxonomyRow, TxType } from '@/types'

export const SEED_TAXONOMY: { category: string; subcategories: string[] }[] = [
  { category: 'Food', subcategories: ['Groceries', 'Eating out', 'Delivery', 'Coffee & snacks'] },
  { category: 'Travel', subcategories: ['Petrol', 'Cab', 'Tolls & parking', 'Public transport', 'Flights/Trains'] },
  { category: 'Shopping', subcategories: ['Clothes', 'Electronics', 'Home', 'Gifts'] },
  { category: 'Fun', subcategories: ['Movies & events', 'Subscriptions', 'Games', 'Hobbies'] },
  { category: 'Car', subcategories: ['EMI', 'Cleaning', 'Service', 'Insurance'] },
  { category: 'Bills', subcategories: ['Rent', 'Electricity', 'iCloud', 'Apple Music', 'Claude', 'Phone/Internet'] },
  { category: 'Health', subcategories: ['Medicine', 'Doctor', 'Gym', 'Personal care'] },
  { category: 'Income', subcategories: ['Salary', 'Cash from Dad', 'Other'] },
  { category: 'Investment', subcategories: ['SIP'] },
  { category: 'Other', subcategories: ['Misc', 'Cash withdrawal', 'Uncategorized'] },
]

// Merge Sheet-configured taxonomy over the seed; seed is the fallback when config empty.
export function buildTaxonomy(rows: TaxonomyRow[]): { category: string; subcategories: string[] }[] {
  if (!rows || rows.length === 0) return SEED_TAXONOMY
  const map = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.category) continue
    const list = map.get(r.category) ?? []
    if (r.subcategory && !list.includes(r.subcategory)) list.push(r.subcategory)
    map.set(r.category, list)
  }
  return [...map.entries()].map(([category, subcategories]) => ({ category, subcategories }))
}

export function subcategoriesFor(taxonomy: { category: string; subcategories: string[] }[], category: string): string[] {
  return taxonomy.find((t) => t.category === category)?.subcategories ?? []
}

// Derive the transaction type from the chosen category so manual entries of
// Income / Investment are recorded correctly instead of defaulting to 'expense'.
export function deriveTxType(category: string): TxType {
  if (category === 'Income') return 'income'
  if (category === 'Investment') return 'investment'
  return 'expense'
}
