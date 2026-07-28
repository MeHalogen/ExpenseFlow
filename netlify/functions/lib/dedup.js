const crypto = require('crypto')

function dedupKey({ amount, bank, merchant, date }) {
  const norm = [
    Number(amount || 0).toFixed(2),
    String(bank || '').toLowerCase().trim(),
    String(merchant || '').toLowerCase().trim(),
    String(date || '').trim(),
  ].join('|')
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 16)
}

module.exports = { dedupKey }
