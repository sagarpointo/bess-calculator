# Pointo — BESS vs Diesel Savings Calculator

A mobile-first React calculator that shows a customer exactly where their money
goes (system price → processing fee → GST → financed amount → EMI) and how much
they save by switching from a diesel generator to a Pointo battery system. On
submit, the visitor's phone number is appended to a Google Sheet so your team can
follow up with a financing quotation.

The calculation engine mirrors the logic in `BESS_VS_DG_calculator.xlsx`
(MAIN SHEET, columns F→R). All tunable constants live in `src/calc.js` → `CONFIG`.

---

## 1. Run locally

```bash
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173).

To test lead capture locally, create a `.env` file (copy `.env.example`) and set
`VITE_SHEET_ENDPOINT` to your deployed Apps Script URL. Without it, the form still
shows the thank-you screen but doesn't record anything.

---

## 2. Connecting the Google Sheet (phone-number capture)

A spreadsheet file can't receive web requests, so we use a Google Sheet plus a
small Google Apps Script "Web App" that appends one row per submission.

**Step 1 — Make the sheet**
1. Go to https://sheets.google.com and create a blank sheet. Name it e.g. *Pointo Leads*.
   (You don't need to add headers — the script adds them automatically on the first lead.)

**Step 2 — Add the script**
1. In that sheet: **Extensions → Apps Script**.
2. Delete the placeholder code and paste the entire contents of
   [`apps-script/Code.gs`](./apps-script/Code.gs).
3. Click the **Save** (disk) icon.

**Step 3 — Deploy as a Web App**
1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" → choose **Web app**.
3. Set:
   - **Execute as:** *Me*
   - **Who has access:** *Anyone*
4. Click **Deploy**. Authorize when prompted (choose your account → Advanced →
   "Go to … (unsafe)" → Allow — this is normal for your own script).
5. Copy the **Web app URL** (it ends in `/exec`). That's your endpoint.

   Tip: paste that URL in a browser — you should see `{"ok":true,...}`. That
   confirms it's live.

**Whenever you edit `Code.gs` later:** use **Deploy → Manage deployments →
edit (pencil) → Version: New version → Deploy** so the change goes live (the URL
stays the same).

Each submission appends a row at the bottom, in order, with:
`Timestamp · Phone · kVA · Backup hours · Solar · Diesel ₹/L · Grid ₹/unit ·
Monthly saving · System price · EMI · Source`.

---

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. On https://vercel.com → **Add New → Project** → import the repo.
3. Vercel auto-detects Vite (Build: `npm run build`, Output: `dist`). Leave defaults.
4. Open **Settings → Environment Variables** and add:
   - **Name:** `VITE_SHEET_ENDPOINT`
   - **Value:** the `/exec` URL from step 2.
5. Click **Deploy**. (If you added the env var after the first deploy, hit
   **Redeploy** so it's picked up — Vite bakes env vars in at build time.)

Done — share the Vercel URL.

---

## 4. Tuning the numbers

Everything adjustable is in `src/calc.js` → `CONFIG`:

| Constant | Meaning | Source |
|---|---|---|
| `PRICE_PER_WH` | ₹17/Wh × kW capacity = system price | sheet R3 |
| `TENURE_MONTHS` | Fixed loan term (18) | sheet Q27 |
| `ANNUAL_INTEREST` | 12% p.a. | sheet Q26 |
| `PROCESSING_FEE_PCT` | 1.5% | sheet Q24/Q44 |
| `GST_SOLAR` / `GST_NO_SOLAR` | 5% / 18% | sheet Q45 |
| `DIESEL_RATE` | 0.3 L per kWh | sheet I9 |
| `BESS_EFFICIENCY` | 0.9 | sheet L9 |
| `DG_MAINT_YR`, `DG_OPERATOR_YR` | DG fixed yearly costs | sheet P4–P7 |

**Note on the financed amount:** the app bases processing fee, GST and EMI on the
pure ₹17/Wh system price. The spreadsheet adds a fixed ₹10,000 (10-yr AMC, cell
R14) before computing these, so the app's total is ~1% lower than the sheet
(e.g. ₹9.75L vs ₹9.87L for 60 kVA). If you want exact parity, add that AMC to
`systemPrice` before the customer-price block in `calc.js`.
