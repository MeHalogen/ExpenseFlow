const { google } = require('googleapis')
const { HEADERS, CORS, getAuth, getTabName, expenseToRow, rowToExpense, ensureTab } = require('./lib/sheets')
const { parseSms } = require('./lib/sms-parser')
const { dedupKey } = require('./lib/dedup')
const { guessCategory } = require('./lib/category-guess')

const SHEET_ID = process.env.SHEET_ID
const INGEST_SECRET = process.env.INGEST_SECRET

async function readRules(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Rules!A2:C' })
    return (res.data.values || []).filter((r) => r[0]).map((r) => ({ keyword: r[0], category: r[1] || 'Other', subcategory: r[2] || '' }))
  } catch { return [] }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  try {
    const { text, secret } = JSON.parse(event.body || '{}')
    if (!INGEST_SECRET || secret !== INGEST_SECRET) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    if (!text) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'text is required' }) }

    const parsed = parseSms(text)

    // Skip advance-notice / reminder messages ("will be debited", "payment due").
    // They aren't real transactions; the actual debit confirmation is captured later.
    if (parsed.isReminder) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'ignored', reason: 'reminder' }) }
    }

    const date = new Date().toISOString().slice(0, 10)
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const rules = await readRules(sheets)
    const guess = guessCategory(parsed.merchant, rules)
    const key = dedupKey({ amount: parsed.amount, bank: parsed.bank, merchant: parsed.merchant, date })
    const tabName = getTabName(date)
    await ensureTab(sheets, SHEET_ID, tabName)

    // Dedup: scan this month's rows for a matching key (id is prefixed with the key)
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tabName}!A2:N` })
    const dup = (existing.data.values || []).some((r) => String(r[0]).startsWith(`ing_${key}_`))
    if (dup) return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'duplicate' }) }

    const record = {
      id: `ing_${key}_${Date.now()}`,
      amount: parsed.amount ?? 0,
      category: guess.category,
      subcategory: guess.subcategory,
      mode: parsed.mode ?? 'UPI',
      bank: parsed.bank ?? '',
      note: '',
      date,
      created_at: new Date().toISOString(),
      type: parsed.direction === 'credit' ? 'income' : 'expense',
      merchant: parsed.merchant ?? '',
      status: 'pending',
      recurringId: '',
      rawSms: text,
    }
    await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${tabName}!A:N`,
      valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [expenseToRow(record)] } })
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'added', expense: rowToExpense(expenseToRow(record)) }) }
  } catch (err) {
    console.error('[ingest-sms]', err.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
