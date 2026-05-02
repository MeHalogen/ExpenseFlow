// /.netlify/functions/get-expenses
// Reads all rows from the "expenses" sheet and returns them as a JSON array

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

  try {
    const sheets   = google.sheets({ version: 'v4', auth: getAuth() })
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range:         `${SHEET_NAME}!A2:H`,   // skip header row
    })

    const rows     = response.data.values || []
    const expenses = rows
      .filter((row) => row[0])               // skip blank rows
      .map((row) => ({
        id:         String(row[0] ?? ''),
        amount:     parseFloat(row[1])  || 0,
        category:   String(row[2] ?? ''),
        mode:       String(row[3] ?? 'UPI'),
        bank:       String(row[4] ?? ''),
        note:       String(row[5] ?? ''),
        date:       String(row[6] ?? ''),
        created_at: String(row[7] ?? ''),
      }))
      .reverse()                             // newest first

    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify({ expenses }),
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
