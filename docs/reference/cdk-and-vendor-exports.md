# CDK & Vendor Export Formats

The input files each tool consumes, with the column quirks and gotchas already
handled in the tool code. Tools locate columns **by header name**, not position,
because vendors reorder columns. When a format changes, see `/update-export-format`.

## Cash Clearing inputs

### CDK Cash Clearing schedule export
- The reconciliation target. The tool auto-detects the store from the
  `Company: NN` line. Schedule rows carry a control the CC report is matched against.

### Credit-card processor settlement report — **June 2026 new processor**
"Settlement Report Transactions / Open Transactions" export. Paste at cell **A1**
(title row 1, headers row 2, data from row 3).

| Field | Column | Header |
|---|---|---|
| Reference number | **C** | `RO#/Other` |
| Amount | **E** | `Sale Amount` |
| Card brand | **G** | `Card` |

Old processor (pre-June 2026), for historical context:

| Field | Old column | Old header |
|---|---|---|
| Reference | A | `Document ID` / `Doc No.` (CO21/CO23 fell back to col R `ReceiptNo`) |
| Amount | F | `Amount` / `Paid Amt` |

Migration notes: matching is now on `RO#/Other` (text-normalized so it works
whether RO numbers are stored as text or numbers); the Notes/brand lookup returns
`Card` (col G); rows with a **blank `RO#/Other` are skipped** by the UNFOUND macro
— review the pasted report for blanks first. The old RO-with-receipt-number
fallback for CO21/CO23 is gone.

- Cash and check exports are also accepted; the card/cash/check files are
  **additive** (drop several and they combine, with a per-file remove button).

## Vehicle Sales inputs

Two files, joined on **GL `Reference` = Deskit `STOCK#`** (case-insensitive,
trims spaces).

### CDK GL / Journal export ("the bible" — determines which deals appear)
- Auto-detects the **CDK Journal Report** layout (hierarchical, with `Refer
  Detail` lines) and reads account/amount/reference from the detail lines.
- A flat GL (one row per entry, Account/Amount or Debit/Credit columns) also
  works; the column mapping is auto-detected and adjustable.
- Columns used: Account #, Reference, Posting Date, Amount (or Debit/Credit).

### Deskit export (cross-reference — dates, customer, vehicle, people)

| Field | Deskit column |
|---|---|
| Stock # (join key) | `STOCK#` |
| Sold date / days in stock | `SOLD DATE`; days = Sold − `INSERVICE DATE` |
| Vehicle (year/model) | `VEHICLE` (leading year split off) |
| Veh type | `VEH TYPE` (New / Used / CPO) |
| Deal type | `TYPE` (Finance / Cash / Lease / Wholesale / DealerTrade / …) |
| Customer | `FIRST NAME` + `LAST NAME` |
| Salesperson | `SP1` |
| Business manager | `FI MANAGER` |

## Parts Reconciliation inputs

### CDK GL Detail export (`.xlsx`)
- Parsed client-side; the row-level GL for the parts accounts.

### Account Balance History export — `BUR_ACCTHIST.xlsx`
- Import to auto-fill accounts **24200 / 24300 / 24401** for every month.

### Monthly inputs from CDK PDFs
- From **MGR / Value by Source**, the physical **recap**, and **Fast Lane**
  reports. Bulk Entry lets you fill a year of months down one column.

### Monthly RAD
- Entered per month; the tool computes the **YTD sum (Jan → rec month)** for each
  reconciliation.

### Step 11 / Step 13 review
- Post-rec-month GL entries with **non-month controls** (JEs, invoice numbers)
  are flagged to assign to Step 11 / Step 13 / Ignore.

## Powerposting inputs (PDFs)

- **Honda / Hyundai** credit-memo invoices → `Invoice_to_CDK_PowerPosting.html`.
  Brand auto-detected (manual override available). Control = last 6 of VIN.
- **Toyota Settled Claims** / **GM Transaction Summary** warranty reports →
  `Warranty_Claims_to_CDK_PowerPosting.html`. The tool reads the embedded PDF
  text directly. See `agje-expert-mode-format.md` for the account/control maps.

## General gotchas

- Always match columns by header text, and **normalize** RO/reference values
  (trim, case-fold, treat numeric vs text the same).
- Excel date serials, title rows, and header rows differ per export — tools
  detect the header row rather than assuming row 1.
- Blank reference rows should be surfaced for manual review, not silently dropped.
