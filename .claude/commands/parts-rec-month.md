---
description: Walk through a monthly parts-inventory-to-GL reconciliation
argument-hint: <rec-month> (e.g. APR2026)
---

Guide a monthly parts reconciliation for `$ARGUMENTS` using the parts-rec tool
(`Parts/_shared/parts-rec/`). This is a workflow helper — the actual computation
lives in the tool; see `docs/reference/cdk-and-vendor-exports.md` and the
glossary for terms (RAD, Step 11/13, BUR_ACCTHIST).

Checklist for the rec month:

1. **GL Detail** — load the CDK Drive GL Detail `.xlsx` for the period.
2. **Balances** — import the Account Balance History export `BUR_ACCTHIST.xlsx`;
   it auto-fills accounts **24200 / 24300 / 24401** for every month.
3. **Monthly inputs** — enter values from the CDK PDFs (**MGR / Value by Source**,
   physical **recap**, **Fast Lane**). Use **Bulk Entry** to fill many months at
   once down a column.
4. **RAD** — enter the month's RAD; the tool computes the **YTD sum (Jan → rec
   month)**.
5. **Step 11 / Step 13 review** — assign post-rec-month entries with non-month
   controls (JEs, invoice numbers) to Step 11 / Step 13 / Ignore (timing
   differences).
6. **Review variance** on the dashboard; drill into any month that doesn't tie.
7. **Export** the polished workbook (Summary + per-month sheets with Step 11/13
   detail) and back up via **Export data (JSON)**.

Tool options (all offline, data stays local): standalone
`parts_rec_standalone.html`, the browser app under `web/`, the Python CLI
(`parts_rec.py template` then `parts_rec.py run`), or the Flask app (`app.py`).
Pick whichever the user already uses. If something doesn't reconcile, walk the
inputs and Step 11/13 assignments rather than guessing — never fabricate figures.
