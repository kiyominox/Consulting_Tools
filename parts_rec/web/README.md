# Parts Inventory Reconciliation – Browser App

A pure browser app for parts-inventory-to-GL reconciliation. No install, no
backend, no Python.  All data stays on your machine in browser localStorage.

## Three ways to use it

### Option 1 — Standalone single file (easiest, no install)

Download **`parts_rec_standalone.html`** (one folder up) and double-click it.
SheetJS is inlined into the file, so it works completely offline.

### Option 2 — GitHub Pages (bookmarkable URL)

Once GitHub Pages is enabled for the repo from a path that includes this
folder, open `parts_rec/web/index.html` in your browser.

To enable Pages:
1. Repo **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` (or the dev branch), folder: `/ (root)`
4. Save — your URL will be `https://<owner>.github.io/<repo>/parts_rec/web/`

### Option 3 — Run locally with a static server (for development)

```bash
cd parts_rec/web
python3 -m http.server 8000
# open http://127.0.0.1:8000
```

## Files

| File                | Purpose                                            |
|---------------------|----------------------------------------------------|
| `index.html`        | Main app (loads `xlsx.full.min.js` from same dir)  |
| `xlsx.full.min.js`  | SheetJS (`xlsx-js-style` build) — reads uploaded Excel files and writes styled `.xlsx` exports in the browser |
| `../parts_rec_standalone.html` | Same app, with the Excel library inlined (single file) |

## How it works

1. **Upload GL Detail** (.xlsx export from CDK Drive) – parsed client-side
2. **Import GL balances** – upload the Account Balance History export (`BUR_ACCTHIST.xlsx`)
   to auto-fill accounts 24200 / 24300 / 24401 for every month
3. **Enter monthly inputs** from CDK PDFs (MGR / Value by Source, recap, Fast Lane).
   Use **Bulk Entry** to type values for many months on one page — fill straight down a
   column while reading a year of balances off the MGR, WIP, or cores report
4. **Enter monthly RAD** – the tool computes the YTD sum (Jan → rec month) for each rec
5. **Review flagged GL entries** – assign post-rec-month entries with non-month
   controls (JEs, invoice numbers) to Step 11 / Step 13 / Ignore
6. **Dashboard** shows multi-month summary, variance trend, and drill-down to detail

## Exporting

- On each month's detail page, the **Step 11** and **Step 13** GL-entry tables have
  **Copy** (tab-separated, paste straight into Excel) and **Export .xlsx** buttons
- The dashboard's **Export to Excel** button builds a polished workbook: a Summary sheet
  plus one sheet per month with the full reconciliation and its Step 11 / Step 13 detail
  tables (colour-coded headers, currency formatting, variance highlighting)

## Data storage

Everything is saved in your browser's `localStorage` under two keys:
- `partsRecState_v1` – inputs, RAD values, review decisions, GL metadata
- `partsRecGL_v1` – the parsed GL rows (can be large)

Use the **Export data (JSON)** button on the dashboard to back up everything to
a file, and **Import data (JSON)** to restore it.  Use this to move between
computers or share with a colleague.

The data is browser-specific — a different browser (or Incognito window) won't
see it.  Clearing browser data also wipes it.
