// /.netlify/functions/get-expenses
// Reads ALL sheet tabs and returns merged expenses as a JSON array

const { google } = require('googleapis')

const SHEET_ID = process.env.SHEET_ID

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

function rowToExpense(row) {
  return {
    id:         String(row[0] ?? ''),
    amount:     parseFloat(row[1])  || 0,
    category:   String(row[2] ?? ''),
    mode:       String(row[3] ?? 'UPI'),
    bank:       String(row[4] ?? ''),
    note:       String(row[5] ?? ''),
    date:       String(row[6] ?? ''),
    created_at: String(row[7] ?? ''),
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })

    // Get all tab names
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets.properties.title',
    })
    const tabs = meta.data.sheets.map((s) => s.properties.title)

    // Read every tab and merge
    const allExpenses = []
    for (const tab of tabs) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range:         `${tab}!A2:H`,
      })
      const rows = res.data.values || []
      rows.filter((r) => r[0]).forEach((row) => allExpenses.push(rowToExpense(row)))
    }

    // Sort newest first
    allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date))

    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify({ expenses: allExpenses }),
    }
  } catch (err) {
    console.error('[get-expenses]', err.message)
    return {
      statusCode: 500,
      headers:    CORS,
      body:       JSON.stringify({ error: err.message }),
    }
  }
}
