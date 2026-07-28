import { describe, it, expect } from 'vitest'
import { guessCategory } from './category-guess.js'

const rules = [
  { keyword: 'swiggy', category: 'Food', subcategory: 'Delivery' },
  { keyword: 'hpcl',   category: 'Travel', subcategory: 'Petrol' },
]

describe('guessCategory', () => {
  it('matches a known merchant', () => {
    expect(guessCategory('SWIGGY Ltd', rules)).toEqual({ category: 'Food', subcategory: 'Delivery' })
  })
  it('falls back when unknown', () => {
    expect(guessCategory('Random Shop', rules)).toEqual({ category: 'Other', subcategory: 'Uncategorized' })
  })
  it('handles null merchant', () => {
    expect(guessCategory(null, rules)).toEqual({ category: 'Other', subcategory: 'Uncategorized' })
  })
})
