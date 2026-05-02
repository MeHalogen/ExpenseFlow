# Google Sheets Setup Guide

Follow these steps once to connect ExpenseFlow to Google Sheets.

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new sheet
2. Rename the default tab to exactly: **`expenses`** (lowercase)
3. Add this header row in **row 1**:

| A  | B      | C        | D    | E    | F    | G    | H          |
|----|--------|----------|------|------|------|------|------------|
| id | amount | category | mode | bank | note | date | created_at |

4. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**THIS_IS_THE_ID**/edit`

---

## Step 2 — Create a Google Service Account

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

## Step 3 — Share the Sheet with the Service Account

1. Open the downloaded JSON — find `client_email` (looks like `name@project.iam.gserviceaccount.com`)
2. Open your Google Sheet → Share → paste that email → give **Editor** access

---

## Step 4 — Set Environment Variables

### For Local Dev (`netlify dev`)

Create a file called `.env.local` in the project root:

```env
GOOGLE_SERVICE_ACCOUNT={"type":"service_account", ... paste entire JSON as one line ... }
SHEET_ID=your_sheet_id_here
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

---

## Step 5 — Run Locally

```bash
npm install -g netlify-cli   # install once
netlify dev                  # starts app + functions on http://localhost:8888
```

---

## Step 6 — Deploy

```bash
git add .
git commit -m "Add Google Sheets backend"
git push
```

Netlify will auto-deploy on push if connected to your repo.
