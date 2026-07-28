function guessCategory(merchant, rules) {
  const m = String(merchant || '').toLowerCase()
  if (m) {
    for (const r of rules || []) {
      if (r.keyword && m.includes(String(r.keyword).toLowerCase())) {
        return { category: r.category || 'Other', subcategory: r.subcategory || '' }
      }
    }
  }
  return { category: 'Other', subcategory: 'Uncategorized' }
}

module.exports = { guessCategory }
