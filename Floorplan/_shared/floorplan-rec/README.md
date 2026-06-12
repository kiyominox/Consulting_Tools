# Floorplan Reconciliation

Reconciles a **bank floorplan billing statement** against the **CDK floorplan
schedule** and shows exactly which units are out of balance. Store- and
group-agnostic — it figures out the columns and the floorplan account itself, so
the same file works for any dealer and any lender (Honda, Nissan/Truist, GM,
etc.).

The deliverable is a single offline file: **`Floorplan Reconciliation.html`**.
Double-click it. **No install, no server, no network calls** — the statements
and schedules never leave the machine.

## What it does

1. **Load two files** (drag-drop or browse): the CDK floorplan schedule and the
   bank floorplan statement. Accepts `.xlsx / .xlsm / .xls / .csv / .tsv / .txt`
   **and `.pdf`** — a bank statement that only comes as a PDF is parsed in the
   browser (pdf.js, inlined; the PDF never leaves the machine) by reconstructing
   the line-item table from the text positions. Layouts vary, so the mapping
   panel is the safety net: confirm the detected columns and re-run.
2. **Auto-detects columns by header content**, not position:
   - the **VIN/serial** column on each side (a header named *VIN* or *Serial*
     wins). Handles full 17-char VINs *and* partial serials in either
     direction: the CDK floorplan schedule prints only the **last 6 of the VIN**
     under *Serial* (e.g. `757192`), while lender statements show the full VIN —
     often with an embedded space (Truist: `5N1AZ3DS7TC 110100`). Spaces are
     stripped and units are matched by suffix overlap;
   - the **balance** column (e.g. *Ending Balance*, *Current Principal*),
     avoiding interest/fee/payment/due columns;
   - on the schedule, the **floorplan account** — when the schedule holds more
     than one GL account, the floorplan account is identified as the one filled
     with **vehicle-sized credit balances** and reconciled in isolation.
3. **Matches units on VIN** (full, last-8, last-6, or automatic suffix overlap).
4. **Reports**:
   - a live **Schedule / Statement / Variance** header that turns **green at
     `0.00`**;
   - **Out of balance** — matched units whose schedule balance ≠ statement
     balance, with the per-unit difference;
   - **On schedule, not on statement** — units still on the books the bank no
     longer shows (sold/paid, or an error);
   - **On statement, not on schedule** — units the bank is billing that aren't on
     the books yet (newly floored, or an error);
   - a per-account strip showing every account found on the schedule and which
     one was treated as the floorplan account.

Every auto-detected column is shown in a **mapping panel** with dropdowns — if a
column was guessed wrong, override it and press **Reconcile** again.

## Outputs

- **Styled `.xlsx`** with a summary tab plus one tab per bucket.
- **Print / PDF** record (the variance band and the active table).
- **JSON backup / restore** and **`localStorage`** persistence so you can close
  and resume, or move the work to another machine.

## Try it

Open the HTML and click **Load sample data** — it loads a small Honda-style
statement and a matching schedule (with one off-balance unit, one schedule-only
"sold" unit, and one statement-only "newly floored" unit) and reconciles them so
you can see the layout without real files.

## Building

This tool is assembled from `src/` so the libraries stay editable:

```
python3 build.py      # → "Floorplan Reconciliation.html"
```

`build.py` inlines `vendor/xlsx.full.min.js` (SheetJS, reading),
`vendor/exceljs.min.js` (ExcelJS, styled writing), `vendor/pdf.min.js` +
`vendor/pdf.worker.min.js` (pdf.js, statement-PDF parsing), and `src/app.js`
into `src/index.template.html`. The pdf.js worker is inlined as inert text and
turned into a Blob URL at runtime, so PDF parsing runs **fully offline** with no
worker fetched from a CDN. The build **aborts if any injected source contains a
literal `</script>`**. Never hand-edit the built `.html` — edit `src/` and
rebuild.

```
Floorplan/_shared/floorplan-rec/
  build.py
  Floorplan Reconciliation.html   ← built artifact (double-click this)
  src/
    index.template.html
    app.js
  vendor/
    xlsx.full.min.js
    exceljs.min.js
    pdf.min.js
    pdf.worker.min.js
```

## Notes on matching & balances

- Balances are compared by **absolute value**, so it doesn't matter whether the
  schedule stores the floorplan as a credit (negative) or the statement shows a
  positive principal — a unit is *balanced* when the two magnitudes agree.
- Total/subtotal rows (e.g. *Total: NEW SUBARU*, *Dealer Total:*, *Total:*) are
  ignored automatically — only rows with a real VIN/serial are counted, so the
  grand-total line a lender repeats in the balance column never double-counts.
- Units the lender still lists at **$0 principal** (sold/paid but not yet
  removed) are treated as not on the floorplan and don't clutter the
  one-sided buckets; a unit on the schedule that the statement zeros out still
  surfaces as *out of balance*.
- Multiple schedule lines for the same VIN (e.g. split across helper rows) are
  summed per VIN before comparing.
