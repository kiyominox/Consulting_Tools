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
| `xlsx.full.min.js`  | SheetJS — parses uploaded Excel files in browser   |
| `../parts_rec_standalone.html` | Same app, with SheetJS inlined (single file) |

## How it works

1. **Upload GL Detail** (.xlsx export from CDK Drive) – parsed client-side
2. **Enter monthly inputs** from CDK PDFs (MGR / Value by Source, recap, Fast Lane, GL balance inquiry)
3. **Enter monthly RAD** – the tool computes the YTD sum (Jan → rec month) for each rec
4. **Review flagged GL entries** – assign post-rec-month entries with non-month
   controls (JEs, invoice numbers) to Step 11 / Step 13 / Ignore
5. **Dashboard** shows multi-month summary, variance trend, and drill-down to detail

## Data storage

Everything is saved in your browser's `localStorage` under two keys:
- `partsRecState_v1` – inputs, RAD values, review decisions, GL metadata
- `partsRecGL_v1` – the parsed GL rows (can be large)

Use the **Export data (JSON)** button on the dashboard to back up everything to
a file, and **Import data (JSON)** to restore it.  Use this to move between
computers or share with a colleague.

The data is browser-specific — a different browser (or Incognito window) won't
see it.  Clearing browser data also wipes it.
