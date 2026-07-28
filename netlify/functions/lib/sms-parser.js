// Pure SMS parser. Never throws; missing fields come back null.
// Tune the regexes against Mehal's real IDBI/ICICI SMS before shipping.

function parseAmount(text) {
  // Rs 1,22,000.00 / INR 450 / Rs.1,299.00
  const m = text.match(/(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseBank(text) {
  if (/icici/i.test(text)) return 'ICICI'
  if (/idbi/i.test(text)) return 'IDBI'
  return null
}

function parseDirection(text) {
  if (/\b(debited|spent|debit|paid|withdrawn)\b/i.test(text)) return 'debit'
  if (/\b(credited|received|credit)\b/i.test(text)) return 'credit'
  return null
}

function parseMode(text) {
  if (/\b(upi|vpa|@)\b/i.test(text)) return 'UPI'
  if (/\b(debit card|credit card|card\s*(no|xx|ending)|pos)\b/i.test(text)) return 'Card'
  return null
}

function parseMerchant(text) {
  // "at AMAZON on", "to SWIGGY", "Swiggy credited", "VPA merchant@bank"
  let m = text.match(/\bat\s+([A-Za-z0-9&.\- ]{2,40}?)\s+on\b/i)
  if (m) return m[1].trim()
  m = text.match(/\bto\s+([A-Za-z0-9&.\- ]{2,40}?)(?:\s+on|\.|;|$)/i)
  if (m) return m[1].trim()
  m = text.match(/([A-Za-z0-9.\-]{2,40})@[a-z]+/i) // VPA
  if (m) return m[1].trim()
  m = text.match(/;\s*([A-Za-z0-9&.\- ]{2,40}?)\s+credited/i)
  if (m) return m[1].trim()
  return null
}

function parseSms(text) {
  const t = String(text || '')
  return {
    amount:    parseAmount(t),
    bank:      parseBank(t),
    mode:      parseMode(t),
    merchant:  parseMerchant(t),
    direction: parseDirection(t),
  }
}

module.exports = { parseSms, parseAmount, parseBank, parseMode, parseMerchant, parseDirection }
