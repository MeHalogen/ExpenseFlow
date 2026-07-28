// /.netlify/functions/get-expenses — reads ALL tabs, returns merged expenses
const { google } = require('googleapis')
const { CORS, getAuth, rowToExpense } = require('./lib/sheets')

const SHEET_ID = process.env.SHEET_ID
const CONFIG_TABS = new Set(['Recurring', 'Rules', 'Taxonomy'])

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties.title' })
    const tabs = meta.data.sheets.map((s) => s.properties.title).filter((t) => !CONFIG_TABS.has(t))

    const all = []
    for (const tab of tabs) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tab}!A2:N` })
      ;(res.data.values || []).filter((r) => r[0]).forEach((row) => all.push(rowToExpense(row)))
    }
    all.sort((a, b) => new Date(b.date) - new Date(a.date))
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ expenses: all }) }
  } catch (err) {
    console.error('[get-expenses]', err.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
