const { google } = require('googleapis')
const { CORS, getAuth } = require('./lib/sheets')

const SHEET_ID = process.env.SHEET_ID

async function readTab(sheets, title, map) {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${title}!A2:Z` })
    return (res.data.values || []).filter((r) => r[0]).map(map)
  } catch { return [] }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const recurring = await readTab(sheets, 'Recurring', (r) => ({
      id: r[0], label: r[1], type: r[2] || 'expense', amount: parseFloat(r[3]) || 0,
      bank: r[4] || '', category: r[5] || '', subcategory: r[6] || '',
      variable: String(r[7]).toLowerCase() === 'true', active: String(r[8]).toLowerCase() !== 'false',
    }))
    const rules = await readTab(sheets, 'Rules', (r) => ({ keyword: r[0], category: r[1] || 'Other', subcategory: r[2] || '' }))
    const taxonomy = await readTab(sheets, 'Taxonomy', (r) => ({ category: r[0], subcategory: r[1] || '' }))
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ recurring, rules, taxonomy }) }
  } catch (err) {
    console.error('[get-config]', err.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
