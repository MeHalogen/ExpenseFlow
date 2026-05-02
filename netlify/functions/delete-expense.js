// /.netlify/functions/delete-expense
// Deletes a row by id from the Google Sheet

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
  if (event.httpMethod !== 'DELETE') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { id } = JSON.parse(event.body || '{}')
    if (!id) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id is required' }) }
    }

    const sheets = google.sheets({ version: 'v4', auth: getAuth() })

    // 1. Get the numeric sheet gid for the "expenses" tab
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
    const sheet       = spreadsheet.data.sheets.find(
      (s) => s.properties.title === SHEET_NAME
    )
    if (!sheet) {
      return {
        statusCode: 404,
        headers:    CORS,
        body:       JSON.stringify({ error: `Sheet "${SHEET_NAME}" not found` }),
      }
    }
    const sheetGid = sheet.properties.sheetId

    // 2. Find the 0-based row index in column A (row 0 = header)
    const colA     = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range:         `${SHEET_NAME}!A:A`,
    })
    const rows     = colA.data.values || []
    const rowIndex = rows.findIndex((row) => row[0] === String(id))

    if (rowIndex === -1) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Row not found' }) }
    }

    // 3. Delete that exact row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId:    sheetGid,
              dimension:  'ROWS',
              startIndex: rowIndex,
              endIndex:   rowIndex + 1,
            },
          },
        }],
      },
    })

    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify({ success: true }),
    }
  } catch (err) {
    console.error('[delete-expense]', err.message)
    return {
      statusCode: 500,
      headers:    CORS,
      body:       JSON.stringify({ error: err.message }),
    }
  }
}
