# Google Sheets Setup Guide

Follow these steps once to connect ExpenseFlow to Google Sheets.

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new sheet
2. Rename the default tab to exactly: **`expenses`** (lowercase)
3. Add this header row in **row 1**:

| A  | B      | C        | D    | E    | F    | G    | H          | I    | J           | K        | L      | M         | N     |
|----|--------|----------|------|------|------|------|------------|------|-------------|----------|--------|-----------|-------|
| id | amount | category | mode | bank | note | date | created_at | type | subcategory | merchant | status | recurringId | rawSms |

4. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**THIS_IS_THE_ID**/edit`

---

## Step 2 — Create Configuration Tabs

Create three additional tabs to configure recurring expenses, category rules, and the taxonomy. Add headers in row 1 of each.

### Tab 1: Recurring Expenses

**Tab name:** `Recurring`

**Header row (A1:I1):**

| A  | B     | C    | D      | E    | F        | G           | H        | I      |
|----|-------|------|--------|------|----------|-------------|----------|--------|
| id | label | type | amount | bank | category | subcategory | variable | active |

**Seed rows (copy these starting at A2):**

| id                | label        | type       | amount | bank  | category   | subcategory    | variable | active |
|-------------------|--------------|-----------|--------|-------|------------|----------------|----------|--------|
| rent              | Rent         | expense    | 16000  | ICICI | Bills      | Rent           | false    | true   |
| karyama           | Karyama      | expense    | 1460   | ICICI |            |                | false    | true   |
| claude            | Claude       | expense    | 2500   | ICICI | Bills      | Claude         | false    | true   |
| icloud            | iCloud       | expense    | 219    | ICICI | Bills      | iCloud         | false    | true   |
| apple_music       | Apple Music  | expense    | 69     | ICICI | Bills      | Apple Music    | false    | true   |
| electricity       | Electricity  | expense    | 1500   | ICICI | Bills      | Electricity    | true     | true   |
| car_cleaning      | Car cleaning | expense    | 500    | ICICI | Car        | Cleaning       | true     | true   |
| sip_icici_leg     | SIP ICICI    | investment | 15000  | ICICI | Investment | SIP            | false    | true   |
| sip_idbi_leg      | SIP IDBI     | investment | 1000   | IDBI  | Investment | SIP            | false    | true   |

**Column descriptions:**
- **id:** Unique identifier for this recurring entry (used for deduplication)
- **label:** Display name in the app
- **type:** One of `expense`, `income`, or `investment` — determines how it affects metrics
- **amount:** Fixed amount (or typical amount if variable=true)
- **bank:** Account to charge: `ICICI`, `IDBI`, or `Cash`
- **category:** Top-level expense category (empty is allowed)
- **subcategory:** Sub-category (empty is allowed)
- **variable:** Set to `true` if the amount changes month-to-month (created as pending); `false` for fixed recurring (created as confirmed)
- **active:** Set to `true` to enable this recurring item; `false` to skip

**How it works:**
- On the first visit of each month, the app calls ensure-recurring to copy active items to the monthly tab
- Each copy gets a unique `recurringId` (format: `rec_<id>_<YYYY-MM>`) for tracking
- Fixed items (`variable=false`) are marked confirmed; variable items are pending review

---

### Tab 2: Category Rules

**Tab name:** `Rules`

**Header row (A1:C1):**

| A       | B        | C           |
|---------|----------|-------------|
| keyword | category | subcategory |

**Initial state:** Empty (rows below headers are for users to add rules)

**Column descriptions:**
- **keyword:** SMS text to match (case-insensitive, substring match)
- **category:** Category to assign if the keyword is found
- **subcategory:** Subcategory to assign (optional)

**How it works:**
- When an expense is confirmed from the Inbox, the SMS is scanned for keywords
- Matching keywords create or update a rule so future similar SMS auto-categorize
- Grows over time as you confirm expenses

---

### Tab 3: Taxonomy (Optional)

**Tab name:** `Taxonomy`

**Header row (A1:B1):**

| A        | B           |
|----------|-------------|
| category | subcategory |

**Initial state:** Empty (the app has a built-in default taxonomy)

**Column descriptions:**
- **category:** Top-level category (e.g., Bills, Food, Travel)
- **subcategory:** Sub-category under that category (e.g., Rent under Bills)

**How it works:**
- If Taxonomy tab is empty or missing, the app uses its default list
- If you add custom entries, the app extends the list (but does not hide defaults)
- Optional — only populate if you need custom categories beyond the built-in set

---

## Step 3 — Create a Google Service Account

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Sheets API**:
   - APIs & Services → Library → search "Google Sheets API" → Enable
4. Create a Service Account:
   - APIs & Services → Credentials → Create Credentials → Service Account
   - Give it any name, click Done
5. Create a JSON key:
   - Click the service account → Keys tab → Add Key → Create new key → JSON
   - Download the `.json` file

---

## Step 4 — Share the Sheet with the Service Account

1. Open the downloaded JSON — find `client_email` (looks like `name@project.iam.gserviceaccount.com`)
2. Open your Google Sheet → Share → paste that email → give **Editor** access

---

## Step 5 — Set Environment Variables

### For Local Dev (`netlify dev`)

Create a file called `.env.local` in the project root:

```env
GOOGLE_SERVICE_ACCOUNT={"type":"service_account", ... paste entire JSON as one line ... }
SHEET_ID=your_sheet_id_here
INGEST_SECRET=change-me-to-a-long-random-string
VITE_INGEST_SECRET=change-me-to-a-long-random-string
```

> **Tip:** To convert the JSON file to a single line, run:
> ```bash
> cat your-service-account.json | tr -d '\n'
> ```

### For Netlify Deployment

1. Go to Netlify Dashboard → Your Site → Site Configuration → Environment Variables
2. Add:
   - `GOOGLE_SERVICE_ACCOUNT` = entire JSON content (single line)
   - `SHEET_ID` = your sheet ID
   - `INGEST_SECRET` = long random string (used to secure the SMS ingest endpoint)
   - `VITE_INGEST_SECRET` = same value as `INGEST_SECRET` (exposed to frontend for the paste box)

---

## Step 6 — Run Locally

```bash
npm install -g netlify-cli   # install once
netlify dev                  # starts app + functions on http://localhost:8888
```

---

## Step 7 — Deploy

```bash
git add .
git commit -m "Add Google Sheets backend"
git push
```

Netlify will auto-deploy on push if connected to your repo.

---

## Column Reference

### Main Expenses Tab (expenses)

The monthly tabs (named `Jul 2026`, `Aug 2026`, etc.) hold transactions with this schema:

| Column | Name        | Type    | Notes                                                    |
|--------|-------------|---------|----------------------------------------------------------|
| A      | id          | string  | Unique ID; `ing_*` = ingest, `rec_*` = recurring         |
| B      | amount      | number  | Transaction amount (always positive)                     |
| C      | category    | string  | Category (Bills, Food, Travel, etc.)                     |
| D      | mode        | string  | Payment mode (UPI, Card, Cash, Auto)                     |
| E      | bank        | string  | Account (ICICI, IDBI, Cash)                              |
| F      | note        | string  | User note or merchant name                               |
| G      | date        | date    | Transaction date (YYYY-MM-DD)                            |
| H      | created_at  | timestamp | When the entry was created                              |
| I      | type        | string  | Transaction type: `expense`, `income`, or `investment`   |
| J      | subcategory | string  | Sub-category (Rent, Electricity, etc.)                   |
| K      | merchant    | string  | Merchant name (from SMS or manual entry)                 |
| L      | status      | string  | `pending` (needs review) or `confirmed` (final)          |
| M      | recurringId | string  | References the recurring entry; empty if not recurring   |
| N      | rawSms      | string  | Original SMS text (for audit trail)                      |

---

## Notes

- Each month gets an auto-created tab named like `Jul 2026` when the first expense is added
- Column headers are automatically added to new monthly tabs
- The app reads from these sheets and writes back confirmed/updated transactions
- Recurring items (Rent, SIP, etc.) are copied to each month on first visit
- SMS ingest creates pending entries that appear in the Inbox for review

