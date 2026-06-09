# Invoice → CDK PowerPosting

A single, self-contained tool that turns a **Honda** or **Hyundai** PDF credit memo into
a CDK AGJE Expert Mode posting string.

## How to use

1. Double-click **`Invoice_to_CDK_PowerPosting.html`** — it opens in any modern web browser
   (Chrome, Edge, Firefox, Safari). No install, no internet connection required.
2. Drag a PDF onto the box (or click to choose one). You can add more than one PDF.
3. The brand is detected automatically. Review the posting table.
4. Click **Send to AGJE Expert Mode** — every line is copied to your clipboard, one per row.
   Paste directly into CDK's AGJE Expert Mode.

Everything runs locally in your browser. The PDF never leaves your computer.

## Posting rules built in

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

The Expert Mode string is `Co.Account.(Amount×100).Control.Control2.Description.Count`,
matching the CDK posting template (the amount is multiplied by 100 so it carries no decimal point).

## Editing the table

Every cell is editable and the Expert Mode preview updates as you type.

- **↑ ↓ ← →** move between cells
- **Enter** moves one cell to the right, wrapping to the first cell of the next row
- **Tab** moves to the next field

If a brand or Hyundai report type is ever detected incorrectly, use the dropdowns on the
file row to set it manually.
