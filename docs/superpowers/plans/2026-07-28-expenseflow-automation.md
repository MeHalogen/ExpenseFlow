# ExpenseFlow Automation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn ExpenseFlow into an auto-capturing, savings-aware system: bank SMS flow into a pending Inbox, fixed bills auto-appear each month, and the dashboard shows real savings and "Dad's cash vs own money."

**Architecture:** Keep the existing stack (React+Vite+TS frontend, CommonJS Netlify functions, Google Sheets backend). Add pure-logic modules (SMS parser, dedup, category-guess, metrics) tested with Vitest; a secret-protected `ingest-sms` function; config tabs (`Recurring`, `Rules`, `Taxonomy`); an idempotent recurring engine; and new frontend screens (Inbox, savings-first Home, paste box, settings).

**Tech Stack:** TypeScript, React 18, Vite 5, Tailwind, Radix Dialog, react-hook-form + zod, date-fns, Recharts, googleapis, Netlify Functions (CommonJS), Vitest (new).

## Global Constraints

- **Backend is Google Sheets via Netlify Functions.** Never call Sheets from the frontend; go through `/.netlify/functions/*`. (Ignore `src/lib/supabase.ts` — it is dead/legacy.)
- **Netlify functions are CommonJS** (`netlify/functions/package.json` = `{"type":"commonjs"}`). Use `require`/`module.exports` in `netlify/functions/**`. The frontend (`src/**`) is ESM/TS.
- **Sheet column positions are append-only.** Existing columns A–H (`id, amount, category, mode, bank, note, date, created_at`) keep their positions and meaning so `delete-expense` (matches id in col A) and old rows keep working. New fields are appended as columns I–N.
- **`bank` (column E) now doubles as `account`** and may hold `ICICI`, `IDBI`, or `Cash`. Source-of-funds is derived: `bank === 'Cash'` → father's money; `ICICI`/`IDBI` → own money. Do NOT add a separate account column.
- **Currency:** INR, `en-IN`, no decimals — use existing `currency()` in `src/lib/utils.ts`.
- **Monthly tab naming:** `"MMM yyyy"` e.g. `Jul 2026` (see `getTabName` in `add-expense.js`). Reuse this exact format everywhere.
- **`ingest-sms` requires a shared secret** (`INGEST_SECRET` env var). Reject requests whose `secret` doesn't match. No other function currently authenticates — that's acceptable for this pass; only ingest is newly exposed to automation.
- **Amounts are numbers**; `date` is `yyyy-MM-dd`; `created_at` is ISO. Match existing conventions.

---

## File Structure

**New backend (CommonJS):**
- `netlify/functions/lib/sms-parser.js` — pure: raw SMS → `{ amount, bank, mode, merchant }`
- `netlify/functions/lib/dedup.js` — pure: transaction → dedup hash
- `netlify/functions/lib/category-guess.js` — pure: `(merchant, rules)` → `{ category, subcategory }`
- `netlify/functions/lib/sheets.js` — shared `getAuth()`, `getTabName()`, `HEADERS` (DRY the copies in every function)
- `netlify/functions/ingest-sms.js` — parse+guess+dedup+append pending row (secret-gated)
- `netlify/functions/update-expense.js` — confirm/edit a row by id; upsert a Rule
- `netlify/functions/get-config.js` — read `Recurring`, `Rules`, `Taxonomy` tabs
- `netlify/functions/ensure-recurring.js` — idempotently materialize recurring items for a month

**New frontend (TS):**
- `src/lib/metrics.ts` — pure: expenses → `{ moneyIn, consumption, netSaved, sourceSplit, sipTotal, fixedTotal, variableTotal }`
- `src/lib/taxonomy.ts` — seed taxonomy + helpers (fallback if config tab empty)
- `src/pages/InboxPage.tsx` — pending list, confirm/edit, batch approve
- `src/pages/SettingsPage.tsx` — manage recurring items + taxonomy (read-first, minimal edit)
- `src/components/PasteSmsBox.tsx` — paste SMS → preview → confirm
- `src/components/DashboardHero.tsx` — money in / consumption / net saved / source scorecard

**Modified:**
- `src/types/index.ts` — extend `Expense`/`ExpenseInput`; add config types
- `src/lib/api.ts` — new client calls
- `src/hooks/useExpenseStore.ts` — pending/config state, ingest/confirm actions
- `src/lib/constants.ts` — accounts, income/investment categories
- `netlify/functions/get-expenses.js`, `add-expense.js` — new columns via shared `sheets.js`
- `src/App.tsx` — Inbox tab + badge, wire new pages
- `src/components/QuickAddSheet.tsx` — type (income/expense/investment), account incl. Cash, subcategory
- `README.md`, `GOOGLE_SHEETS_SETUP.md` — new tabs, columns, iOS Shortcut guide

**New docs:**
- `docs/IOS_SHORTCUT_SETUP.md` — the automation walkthrough

---

## Task 1: Add Vitest test harness

**Files:**
- Modify: `package.json` (scripts + devDependency)
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run test:watch`. Test files may live beside code or under `__tests__`.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest@^2.1.0
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'netlify/**/*.test.js'] },
})
```

- [ ] **Step 3: Add scripts to `package.json`**

Add to the `"scripts"` object:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test** — `src/lib/__tests__/smoke.test.ts`

```ts
import { describe, it, expect } from 'vitest'
describe('harness', () => {
  it('runs', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/__tests__/smoke.test.ts
git commit -m "chore: add vitest test harness"
```

---

## Task 2: Shared Sheets helper + extended schema

**Files:**
- Create: `netlify/functions/lib/sheets.js`
- Test: `netlify/functions/lib/sheets.test.js`

**Interfaces:**
- Produces:
  - `HEADERS: string[]` = the 14 column names (A–N).
  - `getTabName(dateStr) → 'MMM yyyy'`
  - `getAuth() → GoogleAuth`
  - `rowToExpense(row) → Expense-shaped object` (defaults old rows to `type:'expense'`, `status:'confirmed'`)
  - `expenseToRow(obj) → any[]` (length 14, column order = HEADERS)
  - `CORS` headers object

- [ ] **Step 1: Write failing tests** — `netlify/functions/lib/sheets.test.js`

```js
const { describe, it, expect } = require('vitest')
const { HEADERS, getTabName, rowToExpense, expenseToRow } = require('./sheets')

describe('sheets helper', () => {
  it('has 14 headers in canonical order', () => {
    expect(HEADERS).toEqual([
      'id','amount','category','mode','bank','note','date','created_at',
      'type','subcategory','merchant','status','recurringId','rawSms',
    ])
  })
  it('names monthly tab as MMM yyyy', () => {
    expect(getTabName('2026-07-15')).toBe('Jul 2026')
  })
  it('defaults legacy 8-col rows to expense/confirmed', () => {
    const e = rowToExpense(['1','450','Food','UPI','IDBI','lunch','2026-07-01','2026-07-01T00:00:00Z'])
    expect(e.type).toBe('expense')
    expect(e.status).toBe('confirmed')
    expect(e.subcategory).toBe('')
    expect(e.bank).toBe('IDBI')
  })
  it('round-trips through expenseToRow', () => {
    const row = expenseToRow({ id:'2', amount:69, category:'Bills', mode:'Auto', bank:'ICICI',
      note:'', date:'2026-07-01', created_at:'x', type:'expense', subcategory:'Apple Music',
      merchant:'Apple', status:'confirmed', recurringId:'applemusic', rawSms:'' })
    expect(row).toHaveLength(14)
    expect(row[8]).toBe('expense')
    expect(row[9]).toBe('Apple Music')
    expect(rowToExpense(row).recurringId).toBe('applemusic')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- sheets`
Expected: FAIL (Cannot find module './sheets').

- [ ] **Step 3: Implement** — `netlify/functions/lib/sheets.js`

```js
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

module.exports = { HEADERS, CORS, MONTHS, getTabName, getAuth, rowToExpense, expenseToRow }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- sheets`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/sheets.js netlify/functions/lib/sheets.test.js
git commit -m "feat: shared sheets helper with 14-column extended schema"
```

---

## Task 3: Migrate get-expenses & add-expense to shared helper + new columns

**Files:**
- Modify: `netlify/functions/get-expenses.js`
- Modify: `netlify/functions/add-expense.js`

**Interfaces:**
- Consumes: `sheets.js` (`HEADERS, CORS, getAuth, getTabName, rowToExpense, expenseToRow`).
- Produces: `get-expenses` reads `A2:N` and returns full 14-field objects; `add-expense` writes 14-col rows via `expenseToRow` and accepts the new fields.

- [ ] **Step 1: Rewrite `get-expenses.js`**

```js
// /.netlify/functions/get-expenses — reads ALL tabs, returns merged expenses
const { google } = require('googleapis')
const { CORS, getAuth, rowToExpense } = require('./lib/sheets')

const SHEET_ID = process.env.SHEET_ID
const CONFIG_TABS = new Set(['Recurring', 'Rules', 'Taxonomy'])

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties.title' })
    const tabs = meta.data.sheets.map((s) => s.properties.title).filter((t) => !CONFIG_TABS.has(t))

    const all = []
    for (const tab of tabs) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tab}!A2:N` })
      ;(res.data.values || []).filter((r) => r[0]).forEach((row) => all.push(rowToExpense(row)))
    }
    all.sort((a, b) => new Date(b.date) - new Date(a.date))
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ expenses: all }) }
  } catch (err) {
    console.error('[get-expenses]', err.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
```

- [ ] **Step 2: Rewrite `add-expense.js`**

```js
// /.netlify/functions/add-expense — appends one row to the correct monthly tab
const { google } = require('googleapis')
const { HEADERS, CORS, getAuth, getTabName, expenseToRow } = require('./lib/sheets')

const SHEET_ID = process.env.SHEET_ID

async function ensureTab(sheets, spreadsheetId, tabName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' })
  if (!meta.data.sheets.some((s) => s.properties.title === tabName)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] } })
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tabName}!A1:N1`,
      valueInputOption: 'RAW', requestBody: { values: [HEADERS] } })
  }
}

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
```

- [ ] **Step 3: Verify functions still load** (syntax/import check)

Run: `node -e "require('./netlify/functions/get-expenses.js'); require('./netlify/functions/add-expense.js'); console.log('ok')"`
Expected: prints `ok` (no throw). Sheets calls aren't executed here.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/get-expenses.js netlify/functions/add-expense.js
git commit -m "feat: migrate get/add functions to 14-column schema via shared helper"
```

---

## Task 4: SMS parser (pure)

> **IMPORTANT for the implementer:** The regex patterns below are seeded from typical IDBI/ICICI formats. Before this ships, ask Mehal for 3–4 **real** SMS (UPI debit, card debit, and a credit) with account digits redacted, and add each as a test case + tune patterns. The parser must never throw — partial extraction returns what it found with the rest `null`.

**Files:**
- Create: `netlify/functions/lib/sms-parser.js`
- Test: `netlify/functions/lib/sms-parser.test.js`

**Interfaces:**
- Produces: `parseSms(text) → { amount:number|null, bank:'ICICI'|'IDBI'|null, mode:'UPI'|'Card'|null, merchant:string|null, direction:'debit'|'credit'|null }`

- [ ] **Step 1: Write failing tests** — `netlify/functions/lib/sms-parser.test.js`

```js
const { describe, it, expect } = require('vitest')
const { parseSms } = require('./sms-parser')

describe('parseSms', () => {
  it('parses an ICICI UPI debit', () => {
    const r = parseSms('ICICI Bank Acct XX123 debited Rs 450.00 on 15-Jul-26; Swiggy credited. UPI:5123. Call 18001080 if not you.')
    expect(r.bank).toBe('ICICI')
    expect(r.amount).toBe(450)
    expect(r.mode).toBe('UPI')
    expect(r.direction).toBe('debit')
    expect(r.merchant).toMatch(/Swiggy/i)
  })
  it('parses an IDBI card debit', () => {
    const r = parseSms('Rs.1,299.00 spent on IDBI Bank Debit Card XX987 at AMAZON on 16-Jul-26.')
    expect(r.bank).toBe('IDBI')
    expect(r.amount).toBe(1299)
    expect(r.mode).toBe('Card')
    expect(r.merchant).toMatch(/AMAZON/i)
  })
  it('detects credits (income) and does not crash', () => {
    const r = parseSms('ICICI Bank Acct XX123 credited with Rs 1,22,000.00 - Salary.')
    expect(r.direction).toBe('credit')
    expect(r.amount).toBe(122000)
  })
  it('returns nulls, never throws, on garbage', () => {
    const r = parseSms('hello world')
    expect(r.amount).toBeNull()
    expect(r.bank).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- sms-parser`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `netlify/functions/lib/sms-parser.js`

```js
// Pure SMS parser. Never throws; missing fields come back null.
// Tune the regexes against Mehal's real IDBI/ICICI SMS before shipping.

function parseAmount(text) {
  // Rs 1,22,000.00 / INR 450 / Rs.1,299.00
  const m = text.match(/(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseBank(text) {
  if (/icici/i.test(text)) return 'ICICI'
  if (/idbi/i.test(text)) return 'IDBI'
  return null
}

function parseDirection(text) {
  if (/\b(debited|spent|debit|paid|withdrawn)\b/i.test(text)) return 'debit'
  if (/\b(credited|received|credit)\b/i.test(text)) return 'credit'
  return null
}

function parseMode(text) {
  if (/\b(upi|vpa|@)\b/i.test(text)) return 'UPI'
  if (/\b(debit card|credit card|card\s*(no|xx|ending)|pos)\b/i.test(text)) return 'Card'
  return null
}

function parseMerchant(text) {
  // "at AMAZON on", "to SWIGGY", "Swiggy credited", "VPA merchant@bank"
  let m = text.match(/\bat\s+([A-Za-z0-9&.\- ]{2,40}?)\s+on\b/i)
  if (m) return m[1].trim()
  m = text.match(/\bto\s+([A-Za-z0-9&.\- ]{2,40}?)(?:\s+on|\.|;|$)/i)
  if (m) return m[1].trim()
  m = text.match(/([A-Za-z0-9.\-]{2,40})@[a-z]+/i) // VPA
  if (m) return m[1].trim()
  m = text.match(/;\s*([A-Za-z0-9&.\- ]{2,40}?)\s+credited/i)
  if (m) return m[1].trim()
  return null
}

function parseSms(text) {
  const t = String(text || '')
  return {
    amount:    parseAmount(t),
    bank:      parseBank(t),
    mode:      parseMode(t),
    merchant:  parseMerchant(t),
    direction: parseDirection(t),
  }
}

module.exports = { parseSms, parseAmount, parseBank, parseMode, parseMerchant, parseDirection }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- sms-parser`
Expected: PASS, 4 tests. (If a real-sample test fails later, tune the regex — don't weaken the assertion.)

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/sms-parser.js netlify/functions/lib/sms-parser.test.js
git commit -m "feat: pure SMS parser for IDBI/ICICI alerts"
```

---

## Task 5: Dedup hash (pure)

**Files:**
- Create: `netlify/functions/lib/dedup.js`
- Test: `netlify/functions/lib/dedup.test.js`

**Interfaces:**
- Produces: `dedupKey({ amount, bank, merchant, date }) → string` — stable within the same day + amount + merchant, so the automation and a manual paste of the same SMS collide.

- [ ] **Step 1: Write failing tests** — `netlify/functions/lib/dedup.test.js`

```js
const { describe, it, expect } = require('vitest')
const { dedupKey } = require('./dedup')

describe('dedupKey', () => {
  it('is identical for the same amount/merchant/day', () => {
    const a = dedupKey({ amount: 450, bank: 'ICICI', merchant: 'Swiggy', date: '2026-07-15' })
    const b = dedupKey({ amount: 450, bank: 'ICICI', merchant: 'swiggy ', date: '2026-07-15' })
    expect(a).toBe(b)
  })
  it('differs when amount differs', () => {
    const a = dedupKey({ amount: 450, bank: 'ICICI', merchant: 'Swiggy', date: '2026-07-15' })
    const b = dedupKey({ amount: 451, bank: 'ICICI', merchant: 'Swiggy', date: '2026-07-15' })
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- dedup`
Expected: FAIL.

- [ ] **Step 3: Implement** — `netlify/functions/lib/dedup.js`

```js
const crypto = require('crypto')

function dedupKey({ amount, bank, merchant, date }) {
  const norm = [
    Number(amount || 0).toFixed(2),
    String(bank || '').toLowerCase().trim(),
    String(merchant || '').toLowerCase().trim(),
    String(date || '').trim(),
  ].join('|')
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 16)
}

module.exports = { dedupKey }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- dedup`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/dedup.js netlify/functions/lib/dedup.test.js
git commit -m "feat: dedup key to prevent double-logging SMS"
```

---

## Task 6: Category guess from Rules (pure)

**Files:**
- Create: `netlify/functions/lib/category-guess.js`
- Test: `netlify/functions/lib/category-guess.test.js`

**Interfaces:**
- Produces: `guessCategory(merchant, rules) → { category, subcategory }` where `rules` is `[{ keyword, category, subcategory }]`. First case-insensitive substring match wins; no match → `{ category:'Other', subcategory:'Uncategorized' }`.

- [ ] **Step 1: Write failing tests** — `netlify/functions/lib/category-guess.test.js`

```js
const { describe, it, expect } = require('vitest')
const { guessCategory } = require('./category-guess')

const rules = [
  { keyword: 'swiggy', category: 'Food', subcategory: 'Delivery' },
  { keyword: 'hpcl',   category: 'Travel', subcategory: 'Petrol' },
]

describe('guessCategory', () => {
  it('matches a known merchant', () => {
    expect(guessCategory('SWIGGY Ltd', rules)).toEqual({ category: 'Food', subcategory: 'Delivery' })
  })
  it('falls back when unknown', () => {
    expect(guessCategory('Random Shop', rules)).toEqual({ category: 'Other', subcategory: 'Uncategorized' })
  })
  it('handles null merchant', () => {
    expect(guessCategory(null, rules)).toEqual({ category: 'Other', subcategory: 'Uncategorized' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- category-guess`
Expected: FAIL.

- [ ] **Step 3: Implement** — `netlify/functions/lib/category-guess.js`

```js
function guessCategory(merchant, rules) {
  const m = String(merchant || '').toLowerCase()
  if (m) {
    for (const r of rules || []) {
      if (r.keyword && m.includes(String(r.keyword).toLowerCase())) {
        return { category: r.category || 'Other', subcategory: r.subcategory || '' }
      }
    }
  }
  return { category: 'Other', subcategory: 'Uncategorized' }
}

module.exports = { guessCategory }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- category-guess`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/category-guess.js netlify/functions/lib/category-guess.test.js
git commit -m "feat: rule-based category guessing"
```

---

## Task 7: get-config function (Recurring / Rules / Taxonomy)

> One-time manual setup before this works: create tabs `Recurring`, `Rules`, `Taxonomy` in the Google Sheet with the headers below and seed rows. This is documented in Task 15's doc updates; the function only reads.

**Files:**
- Create: `netlify/functions/get-config.js`
- Add redirect in `netlify.toml`

**Interfaces:**
- Produces: `GET /.netlify/functions/get-config` → `{ recurring:[...], rules:[...], taxonomy:[...] }`.
  - Recurring row: `{ id, label, type, amount, bank, category, subcategory, variable, active }`
  - Rules row: `{ keyword, category, subcategory }`
  - Taxonomy row: `{ category, subcategory }`
  - Missing tab → that key is `[]` (never throw).

- [ ] **Step 1: Implement** — `netlify/functions/get-config.js`

```js
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
```

- [ ] **Step 2: Add redirect** in `netlify.toml` (after the delete-expense redirect block)

```toml
[[redirects]]
  from = "/api/get-config"
  to   = "/.netlify/functions/get-config"
  status = 200
  force  = true
```

- [ ] **Step 3: Verify it loads**

Run: `node -e "require('./netlify/functions/get-config.js'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/get-config.js netlify.toml
git commit -m "feat: get-config reads Recurring/Rules/Taxonomy tabs"
```

---

## Task 8: ingest-sms function (secret-gated capture)

**Files:**
- Create: `netlify/functions/ingest-sms.js`
- Add redirect in `netlify.toml`
- Modify: `.env.example` (document `INGEST_SECRET`)

**Interfaces:**
- Consumes: `sms-parser`, `dedup`, `category-guess`, `sheets`, `get-config` logic (re-reads Rules directly).
- Produces: `POST /.netlify/functions/ingest-sms` body `{ text, secret }` →
  - 401 if secret mismatch;
  - 200 `{ status:'duplicate' }` if dedupKey already present in the month tab;
  - 200 `{ status:'added', expense:{...} }` after appending a `pending` row.
  - `direction:'credit'` → `type:'income'`, else `type:'expense'`.

- [ ] **Step 1: Implement** — `netlify/functions/ingest-sms.js`

```js
const { google } = require('googleapis')
const { HEADERS, CORS, getAuth, getTabName, expenseToRow, rowToExpense } = require('./lib/sheets')
const { parseSms } = require('./lib/sms-parser')
const { dedupKey } = require('./lib/dedup')
const { guessCategory } = require('./lib/category-guess')

const SHEET_ID = process.env.SHEET_ID
const INGEST_SECRET = process.env.INGEST_SECRET

async function ensureTab(sheets, tabName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties.title' })
  if (!meta.data.sheets.some((s) => s.properties.title === tabName)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] } })
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${tabName}!A1:N1`,
      valueInputOption: 'RAW', requestBody: { values: [HEADERS] } })
  }
}

async function readRules(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Rules!A2:C' })
    return (res.data.values || []).filter((r) => r[0]).map((r) => ({ keyword: r[0], category: r[1] || 'Other', subcategory: r[2] || '' }))
  } catch { return [] }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  try {
    const { text, secret } = JSON.parse(event.body || '{}')
    if (!INGEST_SECRET || secret !== INGEST_SECRET) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    if (!text) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'text is required' }) }

    const parsed = parseSms(text)
    const date = new Date().toISOString().slice(0, 10)
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const rules = await readRules(sheets)
    const guess = guessCategory(parsed.merchant, rules)
    const key = dedupKey({ amount: parsed.amount, bank: parsed.bank, merchant: parsed.merchant, date })
    const tabName = getTabName(date)
    await ensureTab(sheets, tabName)

    // Dedup: scan this month's rows for a matching key (id is prefixed with the key)
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tabName}!A2:N` })
    const dup = (existing.data.values || []).some((r) => String(r[0]).startsWith(`ing_${key}_`))
    if (dup) return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'duplicate' }) }

    const record = {
      id: `ing_${key}_${Date.now()}`,
      amount: parsed.amount ?? 0,
      category: guess.category,
      subcategory: guess.subcategory,
      mode: parsed.mode ?? 'UPI',
      bank: parsed.bank ?? '',
      note: '',
      date,
      created_at: new Date().toISOString(),
      type: parsed.direction === 'credit' ? 'income' : 'expense',
      merchant: parsed.merchant ?? '',
      status: 'pending',
      recurringId: '',
      rawSms: text,
    }
    await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${tabName}!A:N`,
      valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [expenseToRow(record)] } })
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'added', expense: rowToExpense(expenseToRow(record)) }) }
  } catch (err) {
    console.error('[ingest-sms]', err.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) }
  }
}
```

- [ ] **Step 2: Add redirect** in `netlify.toml`

```toml
[[redirects]]
  from = "/api/ingest-sms"
  to   = "/.netlify/functions/ingest-sms"
  status = 200
  force  = true
```

- [ ] **Step 3: Document env var** — append to `.env.example`

```env
# Shared secret for the SMS ingest endpoint (also stored in the iOS Shortcut)
INGEST_SECRET=change-me-to-a-long-random-string
```

- [ ] **Step 4: Verify it loads**

Run: `node -e "require('./netlify/functions/ingest-sms.js'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/ingest-sms.js netlify.toml .env.example
git commit -m "feat: secret-gated ingest-sms capture endpoint with dedup"
```

---

## Task 9: update-expense function (confirm / edit / learn rule)

**Files:**
- Create: `netlify/functions/update-expense.js`
- Add redirect in `netlify.toml`

**Interfaces:**
- Produces: `POST /.netlify/functions/update-expense` body `{ id, patch, learnRule? }`:
  - Finds the row by id across tabs, overwrites it with `patch`-merged values (via `expenseToRow`).
  - If `learnRule` = `{ keyword, category, subcategory }` and keyword non-empty, upsert into `Rules`.
  - Used by the Inbox to confirm (`patch:{status:'confirmed', category, subcategory}`) and by any edit.

- [ ] **Step 1: Implement** — `netlify/functions/update-expense.js`

```js
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
```

- [ ] **Step 2: Add redirect** in `netlify.toml`

```toml
[[redirects]]
  from = "/api/update-expense"
  to   = "/.netlify/functions/update-expense"
  status = 200
  force  = true
```

- [ ] **Step 3: Verify it loads**

Run: `node -e "require('./netlify/functions/update-expense.js'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/update-expense.js netlify.toml
git commit -m "feat: update-expense confirms/edits rows and learns rules"
```

---

## Task 10: ensure-recurring function (idempotent month materialization)

**Files:**
- Create: `netlify/functions/ensure-recurring.js`
- Add redirect in `netlify.toml`

**Interfaces:**
- Produces: `POST /.netlify/functions/ensure-recurring` body `{ month?: 'yyyy-MM' }` (defaults to current month) →
  For each active `Recurring` row without an existing row carrying `recurringId = rec_<id>_<month>` in that month's tab, append it. Fixed → `status:'confirmed'`; `variable` → `status:'pending'`. Returns `{ created: n }`. Safe to call repeatedly.

- [ ] **Step 1: Implement** — `netlify/functions/ensure-recurring.js`

```js
const { google } = require('googleapis')
const { HEADERS, CORS, getAuth, getTabName, expenseToRow } = require('./lib/sheets')

const SHEET_ID = process.env.SHEET_ID

async function ensureTab(sheets, tabName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties.title' })
  if (!meta.data.sheets.some((s) => s.properties.title === tabName)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] } })
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${tabName}!A1:N1`,
      valueInputOption: 'RAW', requestBody: { values: [HEADERS] } })
  }
}

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

    await ensureTab(sheets, tabName)
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
```

- [ ] **Step 2: Add redirect** in `netlify.toml`

```toml
[[redirects]]
  from = "/api/ensure-recurring"
  to   = "/.netlify/functions/ensure-recurring"
  status = 200
  force  = true
```

- [ ] **Step 3: Verify it loads**

Run: `node -e "require('./netlify/functions/ensure-recurring.js'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/ensure-recurring.js netlify.toml
git commit -m "feat: idempotent recurring-expense engine"
```

---

## Task 11: Extend frontend types + constants + taxonomy seed

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/constants.ts`
- Create: `src/lib/taxonomy.ts`

**Interfaces:**
- Produces:
  - `TxType = 'income'|'expense'|'investment'`, `Account = 'ICICI'|'IDBI'|'Cash'`, `Status = 'pending'|'confirmed'`
  - Extended `Expense` with `type, subcategory, merchant, status, recurringId, rawSms`
  - `SEED_TAXONOMY: { category:string; subcategories:string[] }[]`, `accounts: Account[]`, `txTypes: TxType[]`

- [ ] **Step 1: Rewrite `src/types/index.ts`**

```ts
export type PaymentMode = 'UPI' | 'Card' | 'Cash' | 'Auto'
export type TxType = 'income' | 'expense' | 'investment'
export type Account = 'ICICI' | 'IDBI' | 'Cash'
export type Status = 'pending' | 'confirmed'

export type Expense = {
  id: string
  amount: number
  category: string
  mode: PaymentMode
  bank: string            // account: ICICI | IDBI | Cash
  note: string
  date: string
  created_at: string
  type: TxType
  subcategory: string
  merchant: string
  status: Status
  recurringId: string
  rawSms: string
}
export type ExpenseInput = Omit<Expense, 'id' | 'created_at'>

export type RecurringItem = { id: string; label: string; type: TxType; amount: number; bank: string; category: string; subcategory: string; variable: boolean; active: boolean }
export type Rule = { keyword: string; category: string; subcategory: string }
export type TaxonomyRow = { category: string; subcategory: string }
export type Config = { recurring: RecurringItem[]; rules: Rule[]; taxonomy: TaxonomyRow[] }
```

- [ ] **Step 2: Rewrite `src/lib/constants.ts`**

```ts
import { Wallet, UtensilsCrossed, CarTaxiFront, ShoppingBag, Receipt, HeartPulse, Film, Car, PiggyBank, CircleDollarSign, TrendingUp } from 'lucide-react'

export const categories = [
  { label: 'Food', icon: UtensilsCrossed },
  { label: 'Travel', icon: CarTaxiFront },
  { label: 'Shopping', icon: ShoppingBag },
  { label: 'Fun', icon: Film },
  { label: 'Car', icon: Car },
  { label: 'Bills', icon: Receipt },
  { label: 'Health', icon: HeartPulse },
  { label: 'Income', icon: TrendingUp },
  { label: 'Investment', icon: PiggyBank },
  { label: 'Other', icon: CircleDollarSign },
  { label: 'General', icon: Wallet },
]
export const paymentModes = ['UPI', 'Card', 'Cash', 'Auto'] as const
export const accounts = ['ICICI', 'IDBI', 'Cash'] as const
export const txTypes = ['expense', 'income', 'investment'] as const
export const defaultBanks = ['ICICI', 'IDBI', 'Cash']
```

- [ ] **Step 3: Create `src/lib/taxonomy.ts`**

```ts
import { TaxonomyRow } from '@/types'

export const SEED_TAXONOMY: { category: string; subcategories: string[] }[] = [
  { category: 'Food', subcategories: ['Groceries', 'Eating out', 'Delivery', 'Coffee & snacks'] },
  { category: 'Travel', subcategories: ['Petrol', 'Cab', 'Tolls & parking', 'Public transport', 'Flights/Trains'] },
  { category: 'Shopping', subcategories: ['Clothes', 'Electronics', 'Home', 'Gifts'] },
  { category: 'Fun', subcategories: ['Movies & events', 'Subscriptions', 'Games', 'Hobbies'] },
  { category: 'Car', subcategories: ['EMI', 'Cleaning', 'Service', 'Insurance'] },
  { category: 'Bills', subcategories: ['Rent', 'Electricity', 'iCloud', 'Apple Music', 'Claude', 'Phone/Internet'] },
  { category: 'Health', subcategories: ['Medicine', 'Doctor', 'Gym', 'Personal care'] },
  { category: 'Income', subcategories: ['Salary', 'Cash from Dad', 'Other'] },
  { category: 'Investment', subcategories: ['SIP'] },
  { category: 'Other', subcategories: ['Misc', 'Cash withdrawal', 'Uncategorized'] },
]

// Merge Sheet-configured taxonomy over the seed; seed is the fallback when config empty.
export function buildTaxonomy(rows: TaxonomyRow[]): { category: string; subcategories: string[] }[] {
  if (!rows || rows.length === 0) return SEED_TAXONOMY
  const map = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.category) continue
    const list = map.get(r.category) ?? []
    if (r.subcategory && !list.includes(r.subcategory)) list.push(r.subcategory)
    map.set(r.category, list)
  }
  return [...map.entries()].map(([category, subcategories]) => ({ category, subcategories }))
}

export function subcategoriesFor(taxonomy: { category: string; subcategories: string[] }[], category: string): string[] {
  return taxonomy.find((t) => t.category === category)?.subcategories ?? []
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: no errors. (If existing components reference removed fields, they'll be fixed in later tasks; if tsc fails only in files this task didn't touch, note them for Tasks 15–18.)

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/constants.ts src/lib/taxonomy.ts
git commit -m "feat: extend frontend types, accounts, and taxonomy seed"
```

---

## Task 12: Metrics module (pure, TDD)

**Files:**
- Create: `src/lib/metrics.ts`
- Test: `src/lib/metrics.test.ts`

**Interfaces:**
- Consumes: `Expense[]` (already filtered to a month by the caller).
- Produces: `computeMetrics(expenses: Expense[]) → { moneyIn, consumption, netSaved, sipTotal, ownMoneySpent, dadCashSpent, sourceSplitPct }`
  - `moneyIn` = Σ `type==='income'`
  - `consumption` = Σ `type==='expense'`
  - `sipTotal` = Σ `type==='investment'`
  - `netSaved` = `moneyIn - consumption`
  - `dadCashSpent` = Σ expenses where `bank==='Cash'`; `ownMoneySpent` = consumption − dadCashSpent
  - `sourceSplitPct` = `{ dad, own }` percentages of consumption (0 when consumption is 0)
  - Only `status==='confirmed'` rows count toward money figures (pending are estimates).

- [ ] **Step 1: Write failing tests** — `src/lib/metrics.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { computeMetrics } from './metrics'
import { Expense } from '@/types'

const mk = (p: Partial<Expense>): Expense => ({
  id: Math.random().toString(), amount: 0, category: '', mode: 'UPI', bank: 'ICICI',
  note: '', date: '2026-07-01', created_at: '', type: 'expense', subcategory: '',
  merchant: '', status: 'confirmed', recurringId: '', rawSms: '', ...p,
})

describe('computeMetrics', () => {
  it('separates income, consumption, and investment', () => {
    const m = computeMetrics([
      mk({ type: 'income', amount: 122000, bank: 'ICICI' }),
      mk({ type: 'expense', amount: 450, bank: 'IDBI' }),
      mk({ type: 'expense', amount: 300, bank: 'Cash' }),
      mk({ type: 'investment', amount: 16000, bank: 'ICICI' }),
    ])
    expect(m.moneyIn).toBe(122000)
    expect(m.consumption).toBe(750)
    expect(m.sipTotal).toBe(16000)
    expect(m.netSaved).toBe(121250)
  })
  it('computes source split of consumption', () => {
    const m = computeMetrics([
      mk({ type: 'expense', amount: 750, bank: 'Cash' }),
      mk({ type: 'expense', amount: 250, bank: 'ICICI' }),
    ])
    expect(m.dadCashSpent).toBe(750)
    expect(m.ownMoneySpent).toBe(250)
    expect(m.sourceSplitPct.dad).toBe(75)
    expect(m.sourceSplitPct.own).toBe(25)
  })
  it('ignores pending rows in money figures', () => {
    const m = computeMetrics([mk({ type: 'expense', amount: 999, status: 'pending' })])
    expect(m.consumption).toBe(0)
  })
  it('handles empty input', () => {
    const m = computeMetrics([])
    expect(m.sourceSplitPct).toEqual({ dad: 0, own: 0 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- metrics`
Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/metrics.ts`

```ts
import { Expense } from '@/types'

export function computeMetrics(expenses: Expense[]) {
  const confirmed = expenses.filter((e) => e.status === 'confirmed')
  const sum = (pred: (e: Expense) => boolean) =>
    confirmed.filter(pred).reduce((s, e) => s + e.amount, 0)

  const moneyIn = sum((e) => e.type === 'income')
  const consumption = sum((e) => e.type === 'expense')
  const sipTotal = sum((e) => e.type === 'investment')
  const dadCashSpent = sum((e) => e.type === 'expense' && e.bank === 'Cash')
  const ownMoneySpent = consumption - dadCashSpent
  const netSaved = moneyIn - consumption

  const pct = (part: number) => (consumption > 0 ? Math.round((part / consumption) * 100) : 0)

  return {
    moneyIn, consumption, sipTotal, netSaved, dadCashSpent, ownMoneySpent,
    sourceSplitPct: { dad: pct(dadCashSpent), own: pct(ownMoneySpent) },
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- metrics`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics.ts src/lib/metrics.test.ts
git commit -m "feat: savings + source-split metrics"
```

---

## Task 13: API client + store extensions

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/hooks/useExpenseStore.ts`

**Interfaces:**
- Consumes: functions from Tasks 7–10; `Config` type.
- Produces (api.ts): `fetchConfig(): Promise<Config>`, `ingestSms(text, secret): Promise<{status,expense?}>`, `updateExpense(id, patch, learnRule?): Promise<{expense}>`, `ensureRecurring(month?): Promise<{created}>`.
- Produces (store): adds `config`, `pending` (derived: `expenses.filter(status==='pending')`), and actions `confirmExpense(id, patch, learnRule?)`, `submitSms(text)`. `INGEST_SECRET` read from `import.meta.env.VITE_INGEST_SECRET`.

- [ ] **Step 1: Extend `src/lib/api.ts`** (append these exports; keep existing ones)

```ts
import { Config, Expense } from '@/types'

export async function fetchConfig(): Promise<Config> {
  const res = await fetch(`${FN}/get-config`)
  if (!res.ok) throw new Error(`get-config: ${res.status}`)
  return res.json()
}

export async function ingestSms(text: string, secret: string): Promise<{ status: string; expense?: Expense }> {
  const res = await fetch(`${FN}/ingest-sms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, secret }),
  })
  if (res.status === 401) throw new Error('Ingest secret rejected')
  if (!res.ok) throw new Error(`ingest-sms: ${res.status}`)
  return res.json()
}

export async function updateExpense(id: string, patch: Partial<Expense>, learnRule?: { keyword: string; category: string; subcategory: string }): Promise<{ expense: Expense }> {
  const res = await fetch(`${FN}/update-expense`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, patch, learnRule }),
  })
  if (!res.ok) throw new Error(`update-expense: ${res.status}`)
  return res.json()
}

export async function ensureRecurring(month?: string): Promise<{ created: number }> {
  const res = await fetch(`${FN}/ensure-recurring`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month }),
  })
  if (!res.ok) throw new Error(`ensure-recurring: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 2: Extend the store** — in `src/hooks/useExpenseStore.ts`

Add imports at top:

```ts
import { Config } from '@/types'
import { fetchConfig, ingestSms, updateExpense as apiUpdate, ensureRecurring } from '@/lib/api'
```

Add state (near the other `useState` calls):

```ts
const [config, setConfig] = useState<Config>({ recurring: [], rules: [], taxonomy: [] })
```

In the hydrate `useEffect`, after the `fetchExpenses()` block, also load config and run recurring once per month:

```ts
fetchConfig().then(setConfig).catch((e) => console.warn('[config]', e.message))
const monthKey = format(new Date(), 'yyyy-MM')
if (localStorage.getItem('expenseflow-recurring-ran') !== monthKey) {
  ensureRecurring(monthKey)
    .then(() => { localStorage.setItem('expenseflow-recurring-ran', monthKey); return fetchExpenses() })
    .then((remote) => { setExpenses(remote); localStorage.setItem(LOCAL_KEY, JSON.stringify(remote)) })
    .catch((e) => console.warn('[ensure-recurring]', e.message))
}
```

Add actions before the `return`:

```ts
const confirmExpense = async (id: string, patch: Partial<Expense>, learnRule?: { keyword: string; category: string; subcategory: string }) => {
  setExpenses((prev) => {
    const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
    return next
  })
  try { await apiUpdate(id, patch, learnRule) }
  catch (err) { console.error('[confirmExpense]', err); setError('Update failed — will retry on refresh') }
}

const submitSms = async (text: string) => {
  const secret = import.meta.env.VITE_INGEST_SECRET as string
  const res = await ingestSms(text, secret)
  if (res.expense) {
    setExpenses((prev) => {
      const next = [res.expense as Expense, ...prev]
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      return next
    })
  }
  return res
}
```

Add `Expense` to the existing type import from `@/types`, and update the `return` object to include:

```ts
config,
pending: expenses.filter((e) => e.status === 'pending'),
confirmExpense, submitSms,
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no new errors in `api.ts` / `useExpenseStore.ts`.

- [ ] **Step 4: Add env var** — append to `.env.example`

```env
# Same value as INGEST_SECRET, exposed to the frontend paste box
VITE_INGEST_SECRET=change-me-to-a-long-random-string
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/hooks/useExpenseStore.ts .env.example
git commit -m "feat: store + api for config, ingest, confirm, recurring"
```

---

## Task 14: Inbox page (confirm / edit / batch approve)

**Files:**
- Create: `src/pages/InboxPage.tsx`

**Interfaces:**
- Consumes: `pending: Expense[]`, `config.taxonomy`, `confirmExpense`.
- Produces: `<InboxPage pending config onConfirm />` where `onConfirm(id, patch, learnRule?)`. Each card lets the user fix category/subcategory then confirm; a "Confirm all" button confirms every pending row with its current (guessed) values.

- [ ] **Step 1: Implement** — `src/pages/InboxPage.tsx`

```tsx
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Expense, Config } from '@/types'
import { currency } from '@/lib/utils'
import { buildTaxonomy, subcategoriesFor } from '@/lib/taxonomy'

interface Props {
  pending: Expense[]
  config: Config
  onConfirm: (id: string, patch: Partial<Expense>, learnRule?: { keyword: string; category: string; subcategory: string }) => Promise<void> | void
}

export function InboxPage({ pending, config, onConfirm }: Props) {
  const taxonomy = buildTaxonomy(config.taxonomy)
  const [drafts, setDrafts] = useState<Record<string, { category: string; subcategory: string }>>({})

  const draftFor = (e: Expense) => drafts[e.id] ?? { category: e.category, subcategory: e.subcategory }
  const setDraft = (id: string, d: { category: string; subcategory: string }) =>
    setDrafts((prev) => ({ ...prev, [id]: d }))

  const confirmOne = (e: Expense) => {
    const d = draftFor(e)
    const learnRule = e.merchant ? { keyword: e.merchant, category: d.category, subcategory: d.subcategory } : undefined
    onConfirm(e.id, { status: 'confirmed', category: d.category, subcategory: d.subcategory }, learnRule)
  }

  const fieldCls = 'h-9 rounded-lg bg-surface border border-border px-2 text-[13px] text-white outline-none focus:border-primary/60'

  return (
    <div className="space-y-4 pt-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Inbox</h2>
        {pending.length > 0 && (
          <button onClick={() => pending.forEach(confirmOne)}
            className="pressable rounded-lg bg-primary/15 text-primary text-xs font-semibold px-3 py-1.5">
            Confirm all ({pending.length})
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-muted py-10 text-center">Nothing to review. You're all caught up. 🎉</p>
      ) : (
        pending.map((e) => {
          const d = draftFor(e)
          return (
            <div key={e.id} className="rounded-xl bg-surface border border-border p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="tabular text-base font-semibold text-white">{currency(e.amount)}</p>
                  <p className="text-xs text-muted">{e.merchant || 'Unknown'} · {e.bank || '—'} · {e.mode}</p>
                </div>
                <button onClick={() => confirmOne(e)} aria-label="Confirm"
                  className="pressable flex size-9 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="size-4 stroke-[2.5px]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className={fieldCls} value={d.category}
                  onChange={(ev) => setDraft(e.id, { category: ev.target.value, subcategory: '' })}>
                  {taxonomy.map((t) => <option key={t.category} value={t.category} className="bg-surface">{t.category}</option>)}
                </select>
                <select className={fieldCls} value={d.subcategory}
                  onChange={(ev) => setDraft(e.id, { category: d.category, subcategory: ev.target.value })}>
                  <option value="" className="bg-surface">—</option>
                  {subcategoriesFor(taxonomy, d.category).map((s) => <option key={s} value={s} className="bg-surface">{s}</option>)}
                </select>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors in `InboxPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/InboxPage.tsx
git commit -m "feat: Inbox page with per-row confirm and batch approve"
```

---

## Task 15: Smart-paste box

**Files:**
- Create: `src/components/PasteSmsBox.tsx`

**Interfaces:**
- Consumes: `submitSms(text) → { status, expense? }`.
- Produces: `<PasteSmsBox onSubmit={submitSms} />` — a textarea + "Capture" button; shows the parsed result or "duplicate"/"couldn't read amount"; clears on success. Used inside the Add sheet and/or Inbox header.

- [ ] **Step 1: Implement** — `src/components/PasteSmsBox.tsx`

```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Expense } from '@/types'
import { currency } from '@/lib/utils'

interface Props {
  onSubmit: (text: string) => Promise<{ status: string; expense?: Expense }>
}

export function PasteSmsBox({ onSubmit }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const capture = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      const res = await onSubmit(text.trim())
      if (res.status === 'duplicate') toast('Already captured')
      else if (res.expense && res.expense.amount > 0) { toast.success(`Captured ${currency(res.expense.amount)} → Inbox`); setText('') }
      else toast.warning("Couldn't read the amount — check the Inbox")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Capture failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl bg-surface border border-border p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Paste a bank SMS</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder="Paste the message here…"
        className="w-full rounded-lg bg-ink border border-border px-3 py-2 text-[13px] text-white placeholder:text-muted outline-none focus:border-primary/60 resize-none" />
      <button onClick={capture} disabled={busy}
        className="pressable w-full h-10 rounded-lg bg-primary text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Capturing…' : 'Capture to Inbox'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors in `PasteSmsBox.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/PasteSmsBox.tsx
git commit -m "feat: smart-paste SMS box"
```

---

## Task 16: Dashboard hero (savings-first)

**Files:**
- Create: `src/components/DashboardHero.tsx`
- Modify: `src/pages/HomePage.tsx` (use the hero; keep category donut + recent)

**Interfaces:**
- Consumes: `computeMetrics` result for the current month.
- Produces: `<DashboardHero metrics />` showing Money in, Consumption, Net saved, SIP, and a Dad-cash-vs-own-money source bar.

- [ ] **Step 1: Implement** — `src/components/DashboardHero.tsx`

```tsx
import { currency } from '@/lib/utils'

interface Metrics {
  moneyIn: number; consumption: number; sipTotal: number; netSaved: number
  dadCashSpent: number; ownMoneySpent: number; sourceSplitPct: { dad: number; own: number }
}

export function DashboardHero({ metrics: m }: { metrics: Metrics }) {
  return (
    <section className="space-y-6 pt-4">
      <div>
        <p className="text-sm text-muted mb-1">Net saved this month</p>
        <h2 className={`tabular text-5xl font-bold tracking-tight leading-none ${m.netSaved >= 0 ? 'text-success' : 'text-danger'}`}>
          {currency(m.netSaved)}
        </h2>
        <p className="text-xs text-muted mt-2">
          {currency(m.moneyIn)} in · {currency(m.consumption)} spent · {currency(m.sipTotal)} to SIP
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Where your spending came from</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface flex">
          <div className="h-full bg-success" style={{ width: `${m.sourceSplitPct.dad}%` }} />
          <div className="h-full bg-primary" style={{ width: `${m.sourceSplitPct.own}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-success">Dad's cash {m.sourceSplitPct.dad}% · {currency(m.dadCashSpent)}</span>
          <span className="text-primary">Your money {m.sourceSplitPct.own}% · {currency(m.ownMoneySpent)}</span>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire into `HomePage.tsx`** — change the `Props` to accept `metrics` and replace the old Hero `<section>` with `<DashboardHero metrics={metrics} />`. Update the import block:

```tsx
import { DashboardHero } from '@/components/DashboardHero'
```

Add `metrics` to `Props`:

```tsx
metrics: Parameters<typeof DashboardHero>[0]['metrics']
```

Replace the `{/* ── Hero ─── */}` section with:

```tsx
<DashboardHero metrics={metrics} />
```

(Keep the category donut and Recent sections. The old `totalThisMonth/lastMonthTotal/dailyAverage/insight`/pctChange hero code is removed; if a prop becomes unused, drop it from the interface and the `App.tsx` call.)

- [ ] **Step 3: Compute metrics in the store** — in `useExpenseStore.ts`, add near the derived values:

```ts
import { computeMetrics } from '@/lib/metrics'
// ...
const monthMetrics = useMemo(() => computeMetrics(thisMonthExp), [thisMonthExp])
```

and return `monthMetrics`.

- [ ] **Step 4: Pass it through `App.tsx`** — update the destructure to include `monthMetrics` and pass `metrics={monthMetrics}` to `<HomePage />`.

- [ ] **Step 5: Type-check + build**

Run: `npx tsc -b && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/DashboardHero.tsx src/pages/HomePage.tsx src/hooks/useExpenseStore.ts src/App.tsx
git commit -m "feat: savings-first dashboard hero with source scorecard"
```

---

## Task 17: Wire Inbox + paste into App, add nav tab & badge

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/QuickAddSheet.tsx`

**Interfaces:**
- Consumes: `pending`, `config`, `confirmExpense`, `submitSms`, `monthMetrics` from the store.
- Produces: a new `inbox` tab with a pending-count badge; the Add sheet gains type/account/subcategory fields and embeds `<PasteSmsBox />`.

- [ ] **Step 1: Add the Inbox tab to `App.tsx`**

In the `tabs` array add after `home`:

```tsx
{ key: 'inbox', label: 'Inbox', icon: Inbox },
```

Import `Inbox` from `lucide-react`. Destructure the new store values:

```tsx
const { expenses, banks, loading, syncing, smartDefaults, monthMetrics, config, pending, insight, monthlyData, addExpense, deleteExpense, confirmExpense, submitSms } = useExpenseStore()
```

Render the page:

```tsx
{tab === 'inbox' && <InboxPage pending={pending} config={config} onConfirm={confirmExpense} />}
```

Import `InboxPage`. Add a badge to the inbox nav button (inside the `tabs.map`, after the label):

```tsx
{key === 'inbox' && pending.length > 0 && (
  <span className="absolute -top-0.5 right-3 min-w-4 h-4 px-1 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center">{pending.length}</span>
)}
```

(Make the nav `button` `relative` so the badge anchors.)

- [ ] **Step 2: Extend `QuickAddSheet.tsx`** — add `type`, use `accounts` for the bank select, add a subcategory select driven by taxonomy, and embed the paste box.

Update the zod schema:

```ts
const schema = z.object({
  amount: z.coerce.number().min(1),
  type: z.enum(['expense', 'income', 'investment']).default('expense'),
  category: z.string().min(1),
  subcategory: z.string().optional().default(''),
  mode: z.enum(['UPI', 'Card', 'Cash', 'Auto']),
  bank: z.string().optional().default(''),
  note: z.string().optional().default(''),
  date: z.string(),
}).refine((d) => d.mode === 'Cash' || (d.bank && d.bank.length > 0), {
  message: 'Account is required for UPI and Card', path: ['bank'],
})
```

Add to `Props`: `config: Config` and `onSubmitSms: (text: string) => Promise<{ status: string; expense?: Expense }>`. Use `buildTaxonomy(config.taxonomy)` + `subcategoriesFor` for the subcategory dropdown (mirror the category select pattern already in the file). Set `status: 'confirmed'` when submitting manual entries. When `mode === 'Cash'`, set `bank = 'Cash'` (not empty) so source-split counts it as Dad's cash. Render `<PasteSmsBox onSubmit={onSubmitSms} />` above the manual form under a small "or add manually" divider.

Pass the new props from `App.tsx`:

```tsx
<QuickAddSheet open={sheetOpen} onOpenChange={setSheetOpen} banks={banks} defaults={smartDefaults} config={config} onSubmit={handleAdd} onSubmitSms={submitSms} />
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc -b && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke (optional, needs env)**

Run: `netlify dev` then in the browser: paste a sample SMS → confirm it lands in Inbox → confirm it → verify it leaves Inbox and appears in Recent/metrics.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/QuickAddSheet.tsx
git commit -m "feat: Inbox tab with badge; Add sheet gains type/account/subcategory + paste box"
```

---

## Task 18: Docs — iOS Shortcut, Sheet setup, README

**Files:**
- Create: `docs/IOS_SHORTCUT_SETUP.md`
- Modify: `GOOGLE_SHEETS_SETUP.md` (new tabs + columns)
- Modify: `README.md` (correct stack: Google Sheets not Supabase; new features)

- [ ] **Step 1: Write `docs/IOS_SHORTCUT_SETUP.md`**

Content must include, as concrete steps:
1. Get the deployed site URL and the `INGEST_SECRET` value.
2. Shortcuts app → Automation → New → **Message** → "Message contains" `debited` (repeat for a second automation with `credited`) → **Run Immediately**.
3. Add action **Get Text from Input** (the received message) → **Get Contents of URL**: method `POST`, URL `https://<site>/.netlify/functions/ingest-sms`, header `Content-Type: application/json`, request body (JSON): `{ "text": <Shortcut Input Text>, "secret": "<INGEST_SECRET>" }`.
4. Note the reliability caveats and that the paste box is the fallback.

- [ ] **Step 2: Update `GOOGLE_SHEETS_SETUP.md`** — document the extended header row (A–N: `id, amount, category, mode, bank, note, date, created_at, type, subcategory, merchant, status, recurringId, rawSms`) and the three config tabs with their columns and seed rows:
  - `Recurring`: `id, label, type, amount, bank, category, subcategory, variable, active` — seed Rent/Karyama/Claude/iCloud/Apple Music (variable=false), Electricity/Car cleaning (variable=true), SIP ICICI leg (amount 15000, type=investment) + SIP IDBI leg (amount 1000, type=investment).
  - `Rules`: `keyword, category, subcategory` (start empty; grows as you confirm).
  - `Taxonomy`: `category, subcategory` (optional; empty = use app seed).

- [ ] **Step 3: Fix `README.md`** — replace the Supabase description with Google Sheets; add the new features (auto-capture Inbox, recurring engine, savings dashboard); document `INGEST_SECRET`/`VITE_INGEST_SECRET`.

- [ ] **Step 4: Commit**

```bash
git add docs/IOS_SHORTCUT_SETUP.md GOOGLE_SHEETS_SETUP.md README.md
git commit -m "docs: iOS Shortcut setup, extended sheet schema, README refresh"
```

---

## Self-Review (completed by author)

**Spec coverage:**
- Split capture/categorization → Inbox (Task 14) + pending status (Tasks 2, 8). ✅
- Never lose an expense → partial-parse still appends pending (Task 8). ✅
- Income + savings model → `type` field, metrics (Tasks 2, 11, 12). ✅
- Father's rule / source split → `computeMetrics.sourceSplitPct` + DashboardHero (Tasks 12, 16). ✅
- SIP as investment → excluded from consumption in metrics; Recurring seeds it as investment (Tasks 12, 18). ✅
- Recurring engine → Task 10, triggered in store (Task 13). ✅
- SMS capture (automation + paste) → ingest-sms (Task 8), PasteSmsBox (Task 15), Shortcut doc (Task 18). ✅
- Learns categories → Rules upsert on confirm (Tasks 9, 14). ✅
- Two-level taxonomy, config-driven, editable → taxonomy.ts + Taxonomy tab (Tasks 11, 18). ✅
- Dedup → Task 5 + used in Task 8. ✅
- Secret on ingest → Task 8. ✅
- Savings target deferred → not built (per spec non-goal). ✅
- Migration (rename semantics, new columns, README) → Tasks 2, 3, 18. ✅

**Testing strategy coverage:** parser, dedup, category-guess, metrics all have unit tests (Tasks 4, 5, 6, 12); sheets helper round-trip (Task 2). Ingest auth + recurring idempotency are covered by construction and manual smoke (Task 17 Step 4) — note: these are integration paths against live Sheets, intentionally not unit-tested.

**Placeholder scan:** none — every code step has full content.

**Type consistency:** `Expense` fields (`type, subcategory, merchant, status, recurringId, rawSms`) are defined in Task 11 and used consistently in metrics (12), store (13), Inbox (14), paste (15). `computeMetrics` return shape matches `DashboardHero`'s `Metrics` interface. `bank` holds account values including `Cash` throughout.

**Known follow-ups (non-blocking):** the SMS parser regexes need tuning against Mehal's real IDBI/ICICI messages (flagged in Task 4); an optional scheduled function could replace the client-triggered recurring run if first-visit generation proves unreliable.
