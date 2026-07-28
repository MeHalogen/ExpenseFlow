const { google } = require('googleapis')

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const HEADERS = [
  'id','amount','category','mode','bank','note','date','created_at',
  'type','subcategory','merchant','status','recurringId','rawSms',
]

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
}

function getTabName(dateStr) {
  const d = new Date(dateStr)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
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
    id:          String(row[0] ?? ''),
    amount:      parseFloat(row[1]) || 0,
    category:    String(row[2] ?? ''),
    mode:        String(row[3] ?? 'UPI'),
    bank:        String(row[4] ?? ''),
    note:        String(row[5] ?? ''),
    date:        String(row[6] ?? ''),
    created_at:  String(row[7] ?? ''),
    type:        String(row[8] ?? 'expense'),
    subcategory: String(row[9] ?? ''),
    merchant:    String(row[10] ?? ''),
    status:      String(row[11] ?? 'confirmed'),
    recurringId: String(row[12] ?? ''),
    rawSms:      String(row[13] ?? ''),
  }
}

function expenseToRow(e) {
  return [
    e.id ?? String(Date.now()),
    e.amount ?? 0,
    e.category ?? '',
    e.mode ?? 'UPI',
    e.bank ?? '',
    e.note ?? '',
    e.date ?? '',
    e.created_at ?? new Date().toISOString(),
    e.type ?? 'expense',
    e.subcategory ?? '',
    e.merchant ?? '',
    e.status ?? 'confirmed',
    e.recurringId ?? '',
    e.rawSms ?? '',
  ]
}

async function ensureTab(sheets, spreadsheetId, tabName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' })
  if (!meta.data.sheets.some((s) => s.properties.title === tabName)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] } })
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tabName}!A1:N1`,
      valueInputOption: 'RAW', requestBody: { values: [HEADERS] } })
  }
}

module.exports = { HEADERS, CORS, MONTHS, getTabName, getAuth, rowToExpense, expenseToRow, ensureTab }
