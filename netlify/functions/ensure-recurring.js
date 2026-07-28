const { google } = require('googleapis')
const { HEADERS, CORS, getAuth, getTabName, expenseToRow, ensureTab } = require('./lib/sheets')

const SHEET_ID = process.env.SHEET_ID

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  try {
    const body = JSON.parse(event.body || '{}')
    const month = body.month || new Date().toISOString().slice(0, 7) // yyyy-MM
    const firstOfMonth = `${month}-01`
    const tabName = getTabName(firstOfMonth)
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })

    const recRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Recurring!A2:I' }).catch(() => ({ data: {} }))
    const recurring = (recRes.data.values || []).filter((r) => r[0] && String(r[8]).toLowerCase() !== 'false')

    await ensureTab(sheets, SHEET_ID, tabName)
    const existRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tabName}!A2:N` })
    const existingRecIds = new Set((existRes.data.values || []).map((r) => String(r[12])).filter(Boolean))

    const toAppend = []
    for (const r of recurring) {
      const recTag = `rec_${r[0]}_${month}`
      if (existingRecIds.has(recTag)) continue
      const variable = String(r[7]).toLowerCase() === 'true'
      toAppend.push(expenseToRow({
        id: `${recTag}_${Date.now()}`,
        amount: parseFloat(r[3]) || 0,
        category: r[5] || 'Bills',
        subcategory: r[6] || '',
        mode: 'Auto',
        bank: r[4] || 'ICICI',
        note: r[1] || '',
        date: firstOfMonth,
        created_at: new Date().toISOString(),
        type: r[2] || 'expense',
        merchant: r[1] || '',
        status: variable ? 'pending' : 'confirmed',
        recurringId: recTag,
        rawSms: '',
      }))
    }
    if (toAppend.length) {
      await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${tabName}!A:N`,
        valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: toAppend } })
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ created: toAppend.length, month }) }
  } catch (err) {
    console.error('[ensure-recurring]', err.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
