# CDK PowerPosting Tools

Two single-file, self-contained tools that turn dealer PDFs into CDK AGJE Expert Mode
posting strings:

| File | What it reads |
|------|---------------|
| `Invoice_to_CDK_PowerPosting.html` | Honda / Hyundai credit-memo invoices |
| `Warranty_Claims_to_CDK_PowerPosting.html` | Toyota Settled Claims / GM Transaction Summary (warranty) reports |

Both open in any modern web browser (Chrome, Edge, Firefox, Safari) with no install,
and both run fully offline — the PDF never leaves the computer.
Each has a built-in step-by-step guide — click the **📖 How-To Guide** button in the
top-right corner. From there it can also be printed as a handout (**🖨 Print this guide**).

## How to use (both tools)

1. Double-click the HTML file to open it.
2. Go to the invoice/report online and **download** the PDF.
3. Drag the PDF from your browser's downloads popup — or from your Downloads folder —
   onto the dotted box (or click the box to choose the file).
4. Review the posting table.
5. Click **Send to AGJE Expert Mode** — every line is copied to your clipboard, one per row.
   In CDK's AGJE Expert Mode, **right-click and choose Paste** (Ctrl+V doesn't work there).
6. Ready for the next one? Just drop the next PDF in — the previous one is cleared
   automatically.

The Expert Mode string is `Co.Account.(Amount×100).Control.Control2.Description.Count`,
matching the CDK posting template (the amount is multiplied by 100 so it carries no
decimal point).

## Honda / Hyundai invoice tool

Fully offline — the PDF never leaves the computer. The brand is detected automatically
(with a manual override dropdown).

**Honda** — Company **19**, control = last 6 of VIN, amounts flipped to negative:

| Invoice column | Account |
|----------------|---------|
| DMA            | 511162  |
| FLRPLN         | 511171  |
| TRFR           | 511161  |

**Hyundai** — Company **20**, control = last 6 of VIN, amounts kept negative:

| Report                    | Account |
|---------------------------|---------|
| Advertising Assessment    | 521161  |
| Dealer Holdback Report    | 521160  |
| Dealer Flooring Allowance | 521171  |

## Warranty claims tool (Toyota & GM)

Reads the embedded text of the report — instant, offline, and exact. The brand is
detected automatically (with a manual override dropdown). Everything posts to
Company **21** as credits, balanced by one debit to 532099.

**Toyota** (Settled Claims Report):

| Section of the report          | Account | Control          |
|--------------------------------|---------|------------------|
| PDS claims (Labor Amt Paid)    | 541180  | last 8 of VIN    |
| PDS Sub-Total Sublet Amt       | 532450  | —                |
| Non-PDS claims (Amt Paid)      | 541140  | RO number        |
| ToyotaCare/Boost (Amt Paid)    | 541140  | RO number        |
| Balancing debit                | 532099  | 321              |

**GM** (Transaction Summary Report) — one posting per job card from the Processed
Transaction Summary, using the Job Card Amount Paid column (unpaid job cards are
skipped):

| Job card number                | Account | Control          |
|--------------------------------|---------|------------------|
| Starts with a letter           | 531180  | last 8 of VIN    |
| All digits                     | 531140  | job card (RO) #  |
| Balancing debit                | 532099  | 121              |

After reading, the tool adds up what it read and compares it against the totals
printed on the report itself — green check lines mean everything was read correctly;
a yellow line means a misread to find and fix in the table. The balancing 532099 line
recalculates itself whenever an amount is edited, so the posting always nets to zero.

## Editing the table (both tools)

Every cell is editable and the Expert Mode preview updates as you type.

- **↑ ↓ ← →** move between cells
- **Enter** moves one cell to the right, wrapping to the first cell of the next row
- **Tab** moves to the next field
