# ExpenseFlow

ExpenseFlow is a mobile-first personal expense tracking app built with React, Vite, Tailwind CSS, Framer Motion, and Recharts. It is optimized for fast one-thumb daily logging on phone browsers and is ready to deploy on Netlify.

Transactions are stored in Google Sheets via Netlify serverless functions, with automatic SMS capture, recurring expense automation, and a savings-first dashboard.

## Highlights

- **Smart SMS Capture:** Auto-capture transaction SMS via iOS Shortcuts (with manual paste fallback)
- **Recurring Expenses:** Automatically generate monthly recurring items (subscriptions, SIPs, fixed bills)
- **Savings-First Dashboard:** Shows income, consumption (excluding investments), and savings allocation by source
- **Fast Entry:** Bottom-sheet expense entry with smart defaults and category inference
- **Inbox Review:** Batch-approve pending expenses from SMS and manual paste
- **Analytics:** Trend and bank split charts; transaction search and filters
- **Google Sheets Backend:** Secure, serverless, no database setup — all data in a sheet you control

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- ShadCN-style UI primitives with Radix-based components
- Framer Motion
- Recharts
- Google Sheets (via Netlify Functions)
- Netlify Functions (serverless backend)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Google Sheet and configure environment variables (see [GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md))
3. Copy env values:
   ```bash
   cp .env.example .env.local
   ```
4. Add your Google Sheets and Netlify values in `.env.local`
5. Start development:
   ```bash
   npm run dev
   ```

For SMS automation setup, see [docs/IOS_SHORTCUT_SETUP.md](./docs/IOS_SHORTCUT_SETUP.md).

## Google Sheets Schema

See [GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md) for the complete setup guide.

**Main tabs:**
- `expenses` (or monthly tabs like `Jul 2026`): Transaction records with 14 columns (id, amount, category, mode, bank, note, date, created_at, type, subcategory, merchant, status, recurringId, rawSms)
- `Recurring`: Recurring expenses seeded at month start (subscriptions, bills, SIPs)
- `Rules`: Auto-learned category rules from confirmed SMS
- `Taxonomy`: Optional custom category list (uses app default if empty)

---

## Environment Variables

### Required for Backend (`netlify dev` and deployment)

- `GOOGLE_SERVICE_ACCOUNT`: Entire JSON of your Google Service Account key (single line)
- `SHEET_ID`: Your Google Sheet ID
- `INGEST_SECRET`: Shared secret for the SMS ingest endpoint (e.g., a long random string)

### Required for Frontend

- `VITE_INGEST_SECRET`: Same as `INGEST_SECRET` (exposed for the paste box in the app)

See `.env.example` for examples.

---

## SMS Capture & Ingest

ExpenseFlow can auto-capture SMS transaction notifications via iOS Shortcuts:

1. **Setup automations:** Create two Shortcuts automations (one for "debited", one for "credited") that send SMS to the ingest endpoint
2. **Endpoint:** `POST https://<site>/.netlify/functions/ingest-sms` with JSON body `{ "text": "<SMS>", "secret": "<INGEST_SECRET>" }`
3. **Parser:** Recognizes ICICI, SBI, IDBI, and other Indian bank SMS formats; extracts amount, direction (debit/credit), and merchant
4. **Fallback:** Use the in-app **Paste SMS Box** if Shortcuts fails (low battery, background restrictions, etc.)

For detailed instructions, see [docs/IOS_SHORTCUT_SETUP.md](./docs/IOS_SHORTCUT_SETUP.md).

---

## Recurring Expenses

On the first visit of each month:
1. The app calls `ensure-recurring` to copy active items from the `Recurring` config tab
2. Fixed recurring items (e.g., Rent) are marked **confirmed**
3. Variable recurring items (e.g., Electricity) are marked **pending** for review
4. Each copy gets a unique `recurringId` for tracking

Seed items include subscriptions (Claude, iCloud, Apple Music), bills (Rent, Electricity, etc.), and investments (SIP allocations).

---

## Expense Types & Metrics

Transactions have a **type** field:
- `expense`: Regular spending (Food, Travel, etc.)
- `income`: Earnings or deposits
- `investment`: Savings (SIPs, deposits to investment accounts) — excluded from consumption

Metrics tracked:
- **Income:** Sum of type=income
- **Consumption:** Sum of type=expense
- **SIP Total:** Sum of type=investment (savings allocation)
- **Source Split:** Percentage of consumption by source bank (e.g., "80% from ICICI, 20% from Cash")

---

## Netlify Deploy

1. Push this folder to GitHub
2. Import the repo into Netlify
3. Set build command to `npm run build` and publish directory to `dist`
4. Add environment variables:
   - `GOOGLE_SERVICE_ACCOUNT`
   - `SHEET_ID`
   - `INGEST_SECRET`
   - `VITE_INGEST_SECRET`
5. Deploy

---

## Project Structure

```
├── src/
│   ├── components/       # React UI components (DashboardHero, QuickAddSheet, InboxPage, etc.)
│   ├── lib/              # Utilities (metrics, dedup, category guessing, taxonomy)
│   ├── hooks/            # useExpenseStore (state management)
│   ├── pages/            # Page components (Home, Analytics, Transactions, Inbox)
│   └── types/            # TypeScript definitions (Expense, RecurringItem, Config)
├── netlify/functions/    # Serverless backend (ingest-sms, get-expenses, add-expense, ensure-recurring, etc.)
├── docs/                 # Documentation (IOS_SHORTCUT_SETUP.md)
├── GOOGLE_SHEETS_SETUP.md # Full Google Sheets setup guide
└── README.md
```

---

## Testing

Run unit tests:
```bash
npm test
```

Tests cover:
- SMS parser (recognizes bank formats)
- Deduplication (avoids duplicate entries)
- Category guessing (learns from Rules tab)
- Metrics calculation (income, consumption, SIP totals)
- Sheets helper (round-trip row encoding)

Integration paths (ingest auth, recurring idempotency) are smoke-tested against live Sheets (see Task 17).

---

## Notes

- The app falls back to a static demo when Google Sheets env vars are missing (for client-side testing)
- For full PWA installability, add `vite-plugin-pwa` and a manifest in a later pass
- SMS capture reliability depends on iOS Shortcuts and network — use the paste box as a fallback
- Recurring items are seeded once per month; manual edit directly in the Sheets if needed

---

## License

See LICENSE file for details.
