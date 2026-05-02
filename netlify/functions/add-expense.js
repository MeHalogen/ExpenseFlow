// /.netlify/functions/add-expense
// Appends one expense row to the Google Sheet

const { google } = require('googleapis')

const SHEET_ID   = process.env.SHEET_ID || '1qtYrS41jCtHBHRS4Bz3vn8YwU32IRBu-ClMYbhWobfk'
const SHEET_NAME = 'expenses'

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

    if (!amount || !category || !mode || !bank || !date) {
      return {
        statusCode: 400,
        headers:    CORS,
        body:       JSON.stringify({ error: 'Missing required fields: amount, category, mode, bank, date' }),
      }
    }

    const rowId      = id ?? String(Date.now())
    const created_at = new Date().toISOString()

    // Column order (matches sheet header): id | amount | category | mode | bank | note | date | created_at
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    await sheets.spreadsheets.values.append({
      spreadsheetId:   SHEET_ID,
      range:           `${SHEET_NAME}!A:H`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[rowId, amount, category, mode, bank, note ?? '', date, created_at]],
      },
    })

    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify({ success: true, id: rowId, created_at }),
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
