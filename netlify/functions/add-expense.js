// /.netlify/functions/add-expense
// Appends one expense row to the correct monthly tab (creates tab if needed)

const { google } = require('googleapis')

const SHEET_ID = process.env.SHEET_ID
const HEADERS  = ['id', 'amount', 'category', 'mode', 'bank', 'note', 'date', 'created_at']

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getTabName(dateStr) {
  const d = new Date(dateStr)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT env variable is not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function ensureTab(sheets, spreadsheetId, tabName) {
  const meta   = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' })
  const exists = meta.data.sheets.some((s) => s.properties.title === tabName)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            `${tabName}!A1:H1`,
      valueInputOption: 'RAW',
      requestBody:      { values: [HEADERS] },
    })
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { id, amount, category, mode, bank, note, date } = body

    if (!amount || !category || !mode || !date) {
      return {
        statusCode: 400,
        headers:    CORS,
        body:       JSON.stringify({ error: 'Missing required fields: amount, category, mode, date' }),
      }
    }

    const rowId      = id ?? String(Date.now())
    const created_at = new Date().toISOString()
    const tabName    = getTabName(date)

    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    await ensureTab(sheets, SHEET_ID, tabName)

    await sheets.spreadsheets.values.append({
      spreadsheetId:    SHEET_ID,
      range:            `${tabName}!A:H`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[rowId, amount, category, mode, bank ?? '', note ?? '', date, created_at]],
      },
    })

    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify({ success: true, id: rowId, created_at, tab: tabName }),
    }
  } catch (err) {
    console.error('[add-expense]', err.message)
    return {
      statusCode: 500,
      headers:    CORS,
      body:       JSON.stringify({ error: err.message }),
    }
  }
}
