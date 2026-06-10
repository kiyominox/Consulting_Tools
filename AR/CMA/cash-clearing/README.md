# Cash Clearing Template (CO18)

Daily cash deposit posting / reconciliation workbook for CDK. Instructions are on the
first sheet of the workbook.

## June 2026 update — new credit card processor

The CC tab now expects the new processor's settlement report
("Settlement Report Transactions / Open Transactions" export):

| Field | Old report | New report |
|---|---|---|
| Reference number | Column A `Document ID` | Column C `RO#/Other` |
| Amount | Column F `Amount` | Column E `Sale Amount` |

Changes made:

- **`G` column (On CC Stmnt), Schedule&Rec** — now matches the schedule control against
  `RO#/Other` (CC column C) and sums `Sale Amount` (CC column E). The match is
  text-normalized so it works whether the report stores RO numbers as text or numbers.
- **`L`/`S` Notes columns** — look up `RO#/Other` and return the card brand
  (CC column G) instead of the old "Payment Mode" column.
- **UNFOUND macro (`PopulateNotOnSchedule`)** — reads the reference from CC column C
  (`RO#/Other`) and the amount from CC column E (`Sale Amount`).
- The old RO-number-with-receipt-number-fallback behavior is gone; `RO#/Other` is the
  single reference column. Rows with a blank `RO#/Other` are skipped by the UNFOUND
  macro, so review the pasted report for blanks before running it.
- The CC tab ships with a sample of the new report layout. Paste the new export at
  cell A1 (title row 1, headers row 2, data from row 3), same as before.
