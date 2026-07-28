// /.netlify/functions/add-expense — appends one row to the correct monthly tab
const { google } = require('googleapis')
const { HEADERS, CORS, getAuth, getTabName, expenseToRow, ensureTab } = require('./lib/sheets')

const SHEET_ID = process.env.SHEET_ID

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  try {
    const body = JSON.parse(event.body || '{}')
    const { amount, category, mode, date } = body
    if (!amount || !category || !mode || !date) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields: amount, category, mode, date' }) }
    }
    const record = {
      ...body,
      id: body.id ?? String(Date.now()),
      created_at: new Date().toISOString(),
      type: body.type ?? 'expense',
      status: body.status ?? 'confirmed',
    }
    const tabName = getTabName(date)
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    await ensureTab(sheets, SHEET_ID, tabName)
    await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${tabName}!A:N`,
      valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [expenseToRow(record)] } })
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, id: record.id, created_at: record.created_at, tab: tabName }) }
  } catch (err) {
    console.error('[add-expense]', err.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
