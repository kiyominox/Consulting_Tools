# Cash Clearing Templates (CO18, CO19, CO20, CO21, CO23)

Daily cash deposit posting / reconciliation workbooks for CDK, one per store.
Instructions are on the first sheet of each workbook.

## June 2026 update — new credit card processor

The CC tab now expects the new processor's settlement report
("Settlement Report Transactions / Open Transactions" export):

| Field | Old report | New report |
|---|---|---|
| Reference number | Column A `Document ID` / `Doc No.` (CO21/CO23 fell back to column R `ReceiptNo`) | Column C `RO#/Other` |
| Amount | Column F `Amount` / `Paid Amt` | Column E `Sale Amount` |

Changes made:

- **`G` column (On CC Stmnt), Schedule&Rec** — now matches the schedule control against
  `RO#/Other` (CC column C) and sums `Sale Amount` (CC column E). The match is
  text-normalized so it works whether the report stores RO numbers as text or numbers.
- **`L`/`S` Notes columns** — look up `RO#/Other` and return the card brand
  (CC column G) instead of the old "Payment Mode" column.
- **UNFOUND macro (`PopulateNotOnSchedule`)** — reads the reference from CC column C
  (`RO#/Other`) and the amount from CC column E (`Sale Amount`).
- The old RO-number-with-receipt-number-fallback behavior (formulas and macro in
  CO21/CO23) is gone; `RO#/Other` is the single reference column. Rows with a blank `RO#/Other` are skipped by the UNFOUND
  macro, so review the pasted report for blanks before running it.
- The CC tab ships with a sample of the new report layout. Paste the new export at
  cell A1 (title row 1, headers row 2, data from row 3), same as before.

## Standalone HTML tool (experimental)

`Cash_Clearing_Reconciliation.html` is a browser-based port of the workbook — one file,
no install, no server; everything stays on the local machine.

- **Store**: pick any of the five stores (CO18/19/20/21/23), or let the tool auto-detect
  from the `Company: NN` line of the pasted CDK schedule.
- **Import**: upload (or drag &amp; drop) the CDK Cash Clearing schedule export and the
  processor's settlement report — Excel files (`.xlsx`/`.xlsm`) are read natively in the
  browser (no libraries), and `.csv`/`.tsv`/`.txt` also work. CC columns are located by
  header name (`RO#/Other`, `Sale Amount`, `Card`, …). A **Generate using sample data**
  button loads a built-in balanced example for testing/training.
- **Reconcile**: deposit totals by type, automatic CC matching per control (green = exact,
  amber = amount differs), `Y`/amount Received entry, Unfound Match → editable
  Not-On-Schedule list (re-matches as you correct a reference), and a live
  Deposit/Received/Variance header. (The workbook's BALFWD table was dropped — no longer
  part of the workflow.)
- **Export**: AGJE posting lines in the workbook's exact `Co.Acct.Cents.Control.Control2.
  Desc.Count` format (copy to clipboard for AGJE Expert Mode paste, or download .txt), a
  self-contained HTML reconciliation record and CSV for record keeping, and JSON session
  save/load to resume a day in progress.

Differences from the workbook: rows on the CC report with a blank `RO#/Other` are listed
for manual review when running Unfound (the workbook skips them silently), and the
Not-On-Schedule note goes in the JE Description field rather than Control2.
