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
  from the `Company: NN` line of the schedule. Each store carries its own real account
  numbers (deposit/clearing) and its own Not-On-Schedule categories, all extracted from
  that store's workbook — changing the store updates the accounts, deposit types
  (CO21/CO23 include XTIME) and category options everywhere.
- **Import**: upload (or drag &amp; drop) the CDK Cash Clearing schedule export, plus the
  processor's settlement reports — the card, cash and check exports are **additive**: drop
  them on top of each other and they combine, with a loaded-file list showing each file's
  transaction count/total, a per-file remove button, and a clear-all. Re-adding a file
  with the same name replaces it. Excel files (`.xlsx`/`.xlsm`) are read natively in the
  browser (no libraries), and `.csv`/`.tsv`/`.txt` also work. Columns are located by
  header name (`RO#/Other`, `Sale Amount`, `Card`, …). A **Generate using sample data**
  button loads a built-in balanced example (two report files) for testing/training.
- **Reconcile**: deposit totals by type; automatic CC matching per control (green = exact,
  amber = amount differs). CC-matched items are received automatically — for anything
  received outside the processor you **click “Received in full”** or type the exact amount
  (no more typing `Y`). Unfound Match brings unmatched CC items into an editable
  Not-On-Schedule list where, for CO21/CO23, you pick the **category** (EXT/GM/TOY/CHRY
  WARRANTY, PNC, AR) that routes the posting to the right account; other stores post to
  schedule clearing. A live Deposit/Received/Variance header turns green at 0.00.
  (The workbook's BALFWD table was dropped — no longer part of the workflow.)
- **Donations**: when a payment came in above the schedule amount — rounded up to the
  next whole dollar or a custom amount the customer typed — the schedule row shows a 🎁
  suggestion with the difference (labeled "round-up" or "donation"); tick it and the
  posting splits — schedule amount to clearing, the donation to the store's donation
  account (set per store in ⚙ Setup; posting is blocked with a prompt if a donation is
  marked but no account is configured). JE descriptions distinguish ROUND UP DONATION
  from CUSTOMER DONATION.
- **Setup screen (⚙)**: edit everything per store — names, Co numbers, clearing account,
  round-up donation account,
  deposit types/accounts/control prefixes, and Not-On-Schedule categories with their
  accounts; add or remove stores. Settings save in the browser automatically, and
  **Download shareable copy** regenerates the HTML file itself with your settings baked
  in as the new defaults — replace the original or send it to coworkers.
- **Export**: AGJE posting lines in the workbook's exact `Co.Acct.Cents.Control.Control2.
  Desc.Count` format (copy to clipboard for AGJE Expert Mode paste, or download .txt); a
  polished **PDF** record (print view) and a styled **Excel (.xlsx)** record — both built
  in the browser with no libraries — for record keeping; and JSON session save/load to
  resume a day in progress.

Differences from the workbook: rows on the CC report with a blank `RO#/Other` are listed
for manual review when running Unfound (the workbook skips them silently), and the
Not-On-Schedule note goes in the JE Description field rather than Control2.
