const { google } = require('googleapis')
const { CORS, getAuth, rowToExpense, expenseToRow } = require('./lib/sheets')

const SHEET_ID = process.env.SHEET_ID
const CONFIG_TABS = new Set(['Recurring', 'Rules', 'Taxonomy'])

async function upsertRule(sheets, rule) {
  if (!rule || !rule.keyword) return
  const kw = String(rule.keyword).toLowerCase().trim()
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Rules!A2:C' }).catch(() => ({ data: {} }))
  const rows = cur.data.values || []
  const idx = rows.findIndex((r) => String(r[0]).toLowerCase().trim() === kw)
  const value = [[rule.keyword, rule.category || 'Other', rule.subcategory || '']]
  if (idx === -1) {
    await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: 'Rules!A:C',
      valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: value } })
  } else {
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `Rules!A${idx + 2}:C${idx + 2}`,
      valueInputOption: 'RAW', requestBody: { values: value } })
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  try {
    const { id, patch, learnRule } = JSON.parse(event.body || '{}')
    if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) }
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties.title' })
    const tabs = meta.data.sheets.map((s) => s.properties.title).filter((t) => !CONFIG_TABS.has(t))

    for (const tab of tabs) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tab}!A2:N` })
      const rows = res.data.values || []
      const idx = rows.findIndex((r) => String(r[0]) === String(id))
      if (idx !== -1) {
        const merged = { ...rowToExpense(rows[idx]), ...patch }
        await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${tab}!A${idx + 2}:N${idx + 2}`,
          valueInputOption: 'RAW', requestBody: { values: [expenseToRow(merged)] } })
        if (learnRule) await upsertRule(sheets, learnRule)
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, expense: merged }) }
      }
    }
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Row not found' }) }
  } catch (err) {
    console.error('[update-expense]', err.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
