# iOS Shortcut Automation Setup

ExpenseFlow can automatically capture SMS transaction notifications via iOS Shortcuts. This guide walks through setting up two automation rules — one for debit messages and one for credit messages — that send incoming SMS to the app for processing.

---

## Prerequisites

- iOS Shortcuts app installed (comes with iOS 13+)
- ExpenseFlow deployed and running
- `INGEST_SECRET` configured in your Netlify environment

---

## Step 1: Get Your Deployment Details

1. **Get your site URL:**
   - Open your Netlify dashboard and find your site
   - Copy the site URL (e.g., `https://my-site-name.netlify.app`)

2. **Find `INGEST_SECRET`:**
   - Go to **Site Settings → Environment Variables**
   - Locate the `INGEST_SECRET` value
   - Copy it (keep this safe — do not share)

---

## Step 2: Create the "Debited" Automation

1. Open the **Shortcuts** app
2. Tap **Automation** (bottom navigation)
3. Tap **Create Personal Automation** (or **+** icon)
4. Select **Message**
5. Configure the trigger:
   - Choose **"Message contains"**
   - Type: `debited`
   - Tap **Next**
6. Set the action:
   - Tap **Run Immediately**
   - Tap **Done** (do not ask before running)
7. Leave it on this screen — you'll add the HTTP action in Step 4

---

## Step 3: Create the "Credited" Automation

Repeat Step 2, but type `credited` instead of `debited`. This creates a second automation for incoming credits.

---

## Step 4: Add the Ingest Action to Both Automations

For each automation (debited and credited):

1. After creating the automation, the action prompt appears
2. Tap **Add Action**
3. Search for and select **Get Text from Input** (converts received SMS to text)
4. Tap **Add Action** again
5. Search for and select **Get Contents of URL**
6. Configure:
   - **Method:** `POST`
   - **URL:** `https://<YOUR_SITE_URL>/.netlify/functions/ingest-sms`
   - **Headers:** (expand) Add:
     - Header name: `Content-Type`
     - Value: `application/json`
   - **Request Body:** Select **JSON** and paste:
     ```json
     {
       "text": "Text from Input",
       "secret": "YOUR_INGEST_SECRET"
     }
     ```
     (Replace `YOUR_INGEST_SECRET` with the actual value from Step 1)

7. Tap **Done**

---

## Step 5: Test the Automation

1. Send yourself a test SMS containing the word `debited` or `credited`:
   ```
   Your account was debited 500 INR. Balance: 10000
   ```

2. Check your ExpenseFlow Inbox:
   - If successful, a pending expense appears in the Inbox tab
   - Confirm it to save to the sheet

3. If it doesn't appear:
   - Check Netlify function logs (Site Settings → Functions → ingest-sms)
   - Verify the URL and `INGEST_SECRET` are correct
   - Confirm the SMS contains `debited` or `credited`

---

## Important Notes

### Reliability & Caveats

- **SMS delivery is not guaranteed:** iOS may delay or fail to trigger automation in certain conditions (low battery, background restrictions, network issues)
- **One automation per keyword:** The setup above captures one trigger keyword per automation. To extend to other keywords (e.g., `deducted`, `withdrawn`), create additional automations
- **Manual fallback:** If SMS capture fails, use the **Paste SMS Box** in the app to manually enter the message text

### Security

- Do not share your `INGEST_SECRET` — requests without it receive a 401 error
- The secret prevents unauthorized expense entries from external sources
- Keep your Netlify environment variables private

### Debugging

- **Function returns 401:** Check that `INGEST_SECRET` matches exactly (case-sensitive)
- **Function returns 400:** The `text` field may be empty; verify the SMS contains your trigger keyword
- **No Inbox entry:** Check that the SMS parser recognizes the format (amount, direction like `debited`/`credited`, and bank name when possible)

---

## Example SMS Formats

The SMS parser recognizes these patterns:

```
ICICI Bank: Your account has been debited for INR 1,500.00 on 28-Jul. Available balance: 50,000. Ref: ABC123
SBI Mobile: Amount INR 250 debited from your account ending in 5678.
IDBI Bank: Credited INR 50,000 to your account. Balance: 150,000.
```

If your bank's SMS format is not recognized, log into the app, paste the raw SMS in the Paste Box, and it will be saved as pending for manual review.
