# ExpenseFlow — Automated, Savings-Aware Expense System

**Date:** 2026-07-28
**Status:** Design approved, pending spec review
**Author:** Mehal Srivastava (with Claude)

## Problem

The current ExpenseFlow tracks spending well but relies on **100% manual entry**, which
failed in practice: logging was complete in May, partial in June, and only the first
week of July. Two root causes:

1. **Capture and categorization both require same-day discipline.** On busy days, both
   get skipped and the data is lost for good.
2. **The app is blind to income and savings.** It tracks outflow only, so it cannot answer
   the actual goal — *"how much did I save this month, and am I preserving my salary?"*

The system also cannot express the user's core financial strategy (advice from his father):
**preserve salary, spend cash that his father gives him.**

## Goals

- **Never lose an expense.** Auto-capture bank SMS so no card/UPI spend is missed.
- **Make logging survivable.** Split capture (automatic) from categorization (deferred,
  batchable) so falling behind for a week costs ~30 seconds, not lost data.
- **Show real savings**, not just spending — income in, consumption out, net saved.
- **Honor the father's rule** — make "Dad's cash vs my own money" a first-class, visible metric.
- **Treat SIP correctly** — as savings/investment, never as consumption.
- **Eliminate re-typing fixed bills** — known monthly items auto-appear, pre-categorized.

## Non-Goals (for now)

- A savings target/budget goal (deferred; the model reserves a nullable config for it).
- Fully hands-free SMS reading with zero setup (iOS forbids background SMS reading; the
  iOS Shortcut automation is the closest achievable path).
- Android support, multi-user, or bank API/account-aggregator integration.

## Constraints & Reality Checks

- **iOS cannot let a website silently read SMS.** Achievable capture on iPhone is
  (a) an iOS Shortcuts "message received" automation that POSTs the text to a backend, and
  (b) a manual paste of the SMS into the app. Both are in scope; true zero-touch background
  reading is not possible without jailbreak.
- Keep the existing stack: **React + Vite + TypeScript web app, Netlify functions,
  Google Sheets backend.** Extend it; do not rebuild or add new services.

## User's Financial Picture (context for the model)

- **Take-home salary:** ~₹1,22,000/mo (gross ₹1.5–2L; ~₹12k tax, ~₹18k PF). Raised this month.
- **Accounts / sources of money:**
  - **ICICI** — salary lands here; pays fixed expenses + SIP.
  - **IDBI** — day-to-day spending account.
  - **Cash** — from his father, meant to cover discretionary spend first.
- **Fixed monthly expenses (~₹22,248, all ICICI unless noted):**
  Rent ₹16,000 · Karyama ₹1,460 · Claude ₹2,500 · Electricity ~₹1,500 (varies) ·
  Car cleaning ₹500 (sometimes cash) · iCloud ₹219 · Apple Music ₹69.
- **SIP (investment, not expense):** ~₹16,000/mo, one plan split ₹15,000 ICICI + ₹1,000 IDBI.
- **Flexible remainder:** ~₹83,750/mo splits between discretionary spend and pure savings.

## Architecture Overview

```
Bank SMS ──▶ [ iOS Shortcut automation ] ──┐
                                           ├─▶ ingest-sms (Netlify fn) ─▶ parse ─▶ dedup ─▶ Google Sheet: pending row
You paste ─▶ [ Smart-paste box (web app) ]─┘                                   │
                                                                    reads Rules tab for category guess
Recurring engine (month rollover) ─▶ writes fixed items as confirmed/pending rows
Web app (React) ─▶ Home dashboard · Inbox · Add · Recurring/Settings · Analytics
```

No new infrastructure: the additions are Google Sheet tabs/columns, one new Netlify
function (`ingest-sms`), month-rollover logic, and new/updated React screens.

## Data Model

### Monthly transaction tabs (`Jul 2026`, …) — extended

Every row now carries a `type` so income, spending, and investment coexist and savings math works.

| field | values / type | notes |
|---|---|---|
| `id` | string | existing |
| `date` | date | existing |
| `type` | `income` \| `expense` \| `investment` | **new** — SIP=investment, salary/cash-in=income |
| `amount` | number | existing |
| `account` | `ICICI` \| `IDBI` \| `Cash` | **renamed** from `bank`; `Cash` = father's money |
| `category` | string | existing (now taxonomy-driven) |
| `subcategory` | string | **new** — e.g. Petrol, Delivery, Groceries |
| `mode` | `UPI` \| `Card` \| `Cash` \| `Auto` | existing + `Auto` for recurring debits |
| `merchant` | string | **new** — parsed from SMS (e.g. "Swiggy", a VPA) |
| `status` | `pending` \| `confirmed` | **new** — auto-captured rows start `pending` |
| `recurringId` | string \| "" | **new** — links row to a Recurring template (prevents dupes) |
| `note` | string | existing |
| `rawSms` | string | **new** — original SMS text, for auditing a parse |
| `created_at` | timestamp | existing |

**Source-of-funds is derived, not stored:** `account = Cash` → father's money;
`account ∈ {ICICI, IDBI}` → user's own money. (Default assumption: all Cash is from the
father; a future override can be added if needed.)

### `Recurring` config tab (single, not monthly)

Templates for fixed items, materialized into each month's tab.

| field | notes |
|---|---|
| `id` | stable id, used as `recurringId` on generated rows |
| `label` | e.g. "Rent", "SIP (ICICI leg)" |
| `type` | `expense` \| `investment` |
| `amount` | number |
| `account` | `ICICI` \| `IDBI` \| `Cash` |
| `category` / `subcategory` | pre-assigned |
| `variable` | boolean — if true, generated row starts `pending` as an estimate to correct |
| `active` | boolean |

Seed rows: Rent, Karyama, Claude, iCloud, Apple Music (fixed); Electricity, Car cleaning
(variable → pending estimates); SIP ICICI leg ₹15,000 + SIP IDBI leg ₹1,000 (type=investment).

### `Rules` tab (auto-categorization memory)

| field | notes |
|---|---|
| `keyword` | merchant/VPA substring matched against parsed SMS |
| `category` / `subcategory` | what to assign on a match |

When a pending transaction is confirmed with a (corrected) category, upsert a Rule so the
next matching SMS is pre-categorized. This is how categorization "learns."

### `Taxonomy` config (categories → subcategories)

Config-driven and user-editable (Sheet tab or settings screen). Seed:

- **Food:** Groceries, Eating out, Delivery, Coffee & snacks
- **Travel:** Petrol, Cab, Tolls & parking, Public transport, Flights/Trains
- **Shopping:** Clothes, Electronics, Home, Gifts
- **Fun:** Movies & events, Subscriptions (leisure), Games, Hobbies
- **Car:** EMI, Cleaning, Service, Insurance  *(petrol lives under Travel)*
- **Bills:** Rent, Electricity, iCloud, Apple Music, Claude, Phone/Internet
- **Health:** Medicine, Doctor, Gym, Personal care
- **Other:** Misc, Cash withdrawal, Uncategorized

## Components

### 1. Recurring Engine
On the first app visit of a new month (or a small scheduled function), read `Recurring`
and write each active template into the new month's tab, tagged with `recurringId`.
Fixed items → `confirmed`; `variable` items → `pending` estimates. Idempotent: never write
a template that already has a row for that month (checked via `recurringId` + month).
Result: on day 1, ~₹22k of bills + ₹16k SIP are already logged, correctly categorized.

### 2. `ingest-sms` Netlify function
Input: `{ text, secret }`. Steps:
1. **Auth:** reject unless `secret` matches a configured shared token (env var).
2. **Parse:** per-bank regex patterns (IDBI, ICICI) extract amount, account (last-4 or
   keyword), mode (UPI vs Card via keywords like "UPI"/"VPA"/"debit card"), merchant.
   Partial parses still succeed — a `pending` row is created with whatever was found.
3. **Guess category:** match merchant against `Rules`; else `Other/Uncategorized`.
4. **Dedup:** hash of `amount + merchant + coarse time window`; skip if a matching
   pending/confirmed row already exists (so the automation and a manual paste can't
   double-log the same SMS).
5. **Append** a `pending` row to the current month's tab. Return the parsed result (so the
   paste box can preview it).

### 3. iOS Shortcut automation (one-time setup, documented)
`Automation → Create Personal Automation → Message → "contains 'debited'/'credited'" →
Run Immediately → Get message text → POST to ingest-sms with the shared secret.`
Hands-free capture on good days; the paste box covers banks/edge cases it misfires on.

### 4. Inbox screen
- Lists `pending` rows, newest first, pre-filled with amount/account/mode/merchant + guessed
  category/subcategory.
- **Swipe = confirm.** Tap to correct the category first (which upserts a `Rule`).
- **Batch approve** for catching up a whole week at once.
- Badge shows the pending count.

### 5. Home dashboard (savings-first)
Leads with: **Money in** (salary + cash received) · **Consumption** (real spend) ·
**Net saved this month** (= money in − consumption; SIP is neutral to net worth).
Then: **Source scorecard** — % of spending from **Dad's cash vs own banks** (the
"preserving my salary" measure). **SIP/investments** shown separately as savings.
**Fixed vs variable** split, plus category/subcategory breakdown (existing charts, upgraded).

### 6. Manual add (kept + extended)
Quick manual entry retains its role for the two things SMS can't capture:
**cash spends** and **income events** ("Dad gave me ₹X", salary credit). Plus the new
**smart-paste box** that runs an SMS through `ingest-sms` and shows a preview to confirm.

## App Structure

`Home (dashboard)` · `Inbox` · `Add (manual + paste)` · `Recurring/Settings` · `Analytics`

## Key Metrics (definitions)

- **Consumption** = Σ `type=expense` amounts (money that left net worth), any source.
- **Investment** = Σ `type=investment` (SIP) — leaves cash, stays in net worth.
- **Money in** = Σ `type=income` (salary + cash received from father).
- **Net saved (month)** = Money in − Consumption. (SIP does not subtract — it's still yours.)
- **Source split of consumption** = share from `Cash` (father) vs `ICICI+IDBI` (own money).
  The father's rule is satisfied when own-bank spending stays low and cash covers discretionary.

## Error Handling

- **Partial SMS parse:** create a `pending` row with whatever was extracted; user completes
  it in the Inbox. Never drop the SMS.
- **Unknown bank/format:** amount-only fallback; `account`/`mode` left blank for the user.
- **Duplicate submission:** dedup hash prevents automation + paste double-logging.
- **Sheets/network failure:** existing local-cache fallback continues; retry on reconnect.
- **Ingest without valid secret:** rejected (401), no row written.
- **Month rollover race / re-run:** recurring engine is idempotent via `recurringId` + month.

## Security

- `ingest-sms` requires a **shared secret** (env var) — the endpoint is a public URL.
- The secret is stored in the iOS Shortcut and in the app's paste flow; never in the repo.
- Keep service-account JSON and `SHEET_ID` in env vars as today.

## Testing Strategy

- **SMS parser:** unit tests over a corpus of real IDBI/ICICI SMS samples (UPI + card,
  debit + credit), including partial/garbled cases → assert extracted fields.
- **Dedup:** same SMS via automation and paste → one row.
- **Recurring engine:** month rollover generates each template once; re-run is a no-op;
  variable items land as `pending`.
- **Metrics:** fixture month → assert Consumption, Money in, Net saved, and source split.
- **Ingest auth:** missing/wrong secret → 401, no write.

## Migration

- Rename `bank` → `account` and backfill existing rows; add new columns with sensible
  defaults (`type=expense`, `status=confirmed`, empty `subcategory/merchant/rawSms/recurringId`).
- Create `Recurring`, `Rules`, and `Taxonomy` tabs with seed data above.
- Update the stale README (it references Supabase; the live backend is Google Sheets).

## Open Items (deferred, not blocking)

- **Savings target/budget goal** — nullable config; adopt later without rework.
- Optional scheduled function for month rollover if first-visit generation proves unreliable.
- Possible per-transaction "cash source override" if not all cash is from the father.
