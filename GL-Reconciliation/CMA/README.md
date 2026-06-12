# Toyota Statement Reconciliation (CMA)

Browser tool that reconciles the monthly Toyota factory statement against what has been posted to the GL in CDK Drive. Built for the office manager's month-end Toyota payable reconciliation. (GM statement support planned.)

**Goal:** once everything is posted, `GL = Statement − Incentives`.

## How to use

Open `Toyota_Statement_Reconciliation.html` in a browser (Chrome/Edge) and load three files:

1. **Toyota Statement (PDF)** – the Toyota Motor Sales monthly statement with the Amount Due (auto-ACH on the 15th).
2. **Incentive Payout (PDF)** – the TFS Account Holder Statement showing the Net due *from* TFS (VPP payouts, etc.). Optional.
3. **CDK Control Detail (Excel)** – GL Inquiry → Control Detail Report for the Toyota payable control, **history turned OFF**, exported to Excel.

Click **Reconcile**.

## What it does

- Matches each statement invoice to GL postings by invoice number + amount (statement invoices are expected as credits on the control; incentives as debits).
- Handles CDK quirks automatically: 10-character truncated reference fields, leading zeros, and multiple GL lines posted under one reference (it sums them).
- Anything uncertain (amount matches but the reference differs, possible typo in the posted invoice number, reference matches but amount differs) goes to a **Needs Your Review** queue with ✔ Match / ✘ Not a match buttons — your decisions flow into the totals and the report.
- **Manual clearing (bank-rec style):** for anything the auto-matcher can't pair, tick the statement/incentive item in the "Not Found in GL" lists and tick the GL entry (or several entries) that actually covers it, then click **Mark these reconciled** in the bar at the bottom. A running tally shows whether the selection balances (GL = −Statement + Incentives). Cleared bundles move to a **Manually Reconciled** section and out of the exception lists; each can be unmatched.
- Exceptions are listed separately: statement items not yet posted, incentives not yet posted, and GL entries that aren't on the statement (informational — deal postings, weekly parts payments, etc.).
- **Save Report** exports a multi-tab Excel reconciliation report (Summary, Matched, Stmt Not Posted, Incentives Not Posted, GL Not On Statement). **Print / PDF** gives a printable version.

Everything runs locally in the browser — no data leaves the machine (the page loads its pdf.js/SheetJS libraries from a CDN, so it needs internet access the first time).
