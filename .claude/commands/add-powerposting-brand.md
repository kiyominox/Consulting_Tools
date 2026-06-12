---
description: Add a new brand/document parser to a Powerposting tool
argument-hint: <brand> <invoice|warranty> (e.g. Kia invoice)
---

Add support for a new franchise/brand or document layout to a Powerposting tool.
Arguments: `$ARGUMENTS` (brand + document type).

Powerposting tools turn dealer PDFs into AGJE Expert Mode strings, fully offline.
Two tools today:
- `Powerposting/CMA/Invoice_to_CDK_PowerPosting.html` — Honda/Hyundai credit-memo invoices
- `Powerposting/CMA/Warranty_Claims_to_CDK_PowerPosting.html` — Toyota/GM warranty reports

Steps:

1. **Get the brand's posting rules from the user — these are real GL accounts, do
   not invent them.** Capture into `docs/reference/agje-expert-mode-format.md` and
   `account-control-maps.md`:
   - Company number.
   - Account for each invoice column / report section.
   - Control source (last 6 of VIN, last 8 of VIN, RO #, job-card #, …).
   - Sign convention (e.g. flipped negative) and any balancing debit account.

2. **Pick the right tool** (invoice vs warranty) and study how an existing brand
   is implemented: brand auto-detection, the embedded-text/PDF parsing, the
   per-section account/control mapping, and the editable table with live AGJE
   preview.

3. **Add the new brand**: detection signature (with manual-override dropdown
   entry), the parsing for its PDF layout, and its account/control map. Match the
   existing AGJE string format `Co.Account.(Amount×100).Control.Control2.Desc.Count`.

4. **Add the read-vs-printed-total check** if the document prints totals (green =
   read correctly, yellow = misread), and keep any balancing line auto-recomputing
   to net zero.

5. **Test** with a sample/redacted PDF from the user; confirm strings paste-ready
   (one line per row) and totals tie out. Update the tool's README + How-To guide.

Keep it offline and single-file — the PDF must never leave the machine.
