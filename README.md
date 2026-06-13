# Nicole's Consulting Tools

A collection of CDK consulting tools organized by tool type.

## Structure

```
<ToolType>/
  _shared/          ← tools that apply across all stores/groups
  <store-or-group>/ ← store- or group-specific variants
```

> **Master / `_shared` convention.** Every tool under a `_shared/` folder is the
> store-agnostic **master** you iterate from. Masters are themed in purple
> (`#6B298C`) — if a tool opens purple, it's the master, not a live store build —
> carry no dealer branding, and ship with **fictional** demo data (Hill Valley
> Honda, Bedrock Hyundai, Gotham Toyota-Chevrolet, Homer Simpson, Gringotts
> Floorplan Bank, …). Clone a master per store with `/new-store-tool` and swap in
> the real accounts/branding.

Current tool types:

| Folder | Contents |
|---|---|
| `AP/` | Accounts Payable tools (coming soon) |
| `AR/` | Cash Clearing reconciliation template (CMA) |
| `Floorplan/` | Floorplan Reconciliation (bank statement ↔ CDK schedule) |
| `GL-Reconciliation/` | GL Posting Validator |
| `Parts/` | Parts Inventory Reconciliation |
| `Powerposting/` | Powerposting tools (coming soon) |
| `Vehicle-Sales/` | Vehicle Sales Report Generator |
| `Documentation/` | Reference documents and quick guides |

## Tools

### Floorplan/_shared/floorplan-rec
Standalone HTML tool that reconciles a bank floorplan billing statement against
the CDK floorplan schedule. Store- and group-agnostic: it auto-detects the VIN
(full or partial) and balance columns on either side, identifies the floorplan
account on the schedule by its vehicle-sized credit balances, matches units on
VIN, and reports per-unit and total variances (plus units on only one side).

A **CMA-branded** build (logo, navy/orange palette) lives at
`Floorplan/CMA/floorplan-rec/` — same tool, skinned for Carter Myers Automotive.

See `Floorplan/_shared/floorplan-rec/README.md` for details.

### AR/_shared/cash-clearing
Store-agnostic master of the daily Cash Clearing Reconciliation (ported from the
CMA workbook). Per-store accounts/deposit types/Not-On-Schedule categories live
in an editable config (⚙ Setup + **Download shareable copy**); ships with five
fictional demo stores. See `AR/_shared/cash-clearing/README.md`.

### GL-Reconciliation/_shared/gl-posting-validator
Already-agnostic GL Posting Month Validator (GL postings vs. RRH receipt history),
purple-themed master. See its README.

### GL-Reconciliation/_shared/statement-reconciliation
De-branded master of the factory-statement reconciliation tool (`GL = Statement −
Incentives`). Parses the Toyota/TFS statement layout; adapt the parser per maker.
See its README (note: still loads pdf.js/xlsx from a CDN — flagged for inlining).

### Powerposting/_shared
Masters of the two PDF→AGJE Powerposting tools (Honda/Hyundai invoices;
Toyota/GM warranty). Per-dealer Co numbers and GL accounts are in an editable
`MASTER CONFIG` block. See `Powerposting/_shared/README.md`.

### Parts/_shared/parts-rec
Parts inventory reconciliation tool. Available as:
- Standalone HTML file (no server needed)
- Flask web app (Python backend)
- Browser-only web version (GitHub Pages compatible)

See `Parts/_shared/parts-rec/web/README.md` for usage options.

### Vehicle-Sales/_shared/vehicle-sales-report
Standalone HTML report generator for vehicle sales. Joins CDK GL exports with Deskit exports.
Pre-loaded with MacDonald and Hillside dealership charts of accounts.

See `Vehicle-Sales/_shared/vehicle-sales-report/README.md` for details.

## Adding New Tools

- Place tools that apply to all stores under `<ToolType>/_shared/<tool-name>/`.
- Place store-specific tools under `<ToolType>/<store-or-group>/<tool-name>/`.
- Use hyphenated folder names (no spaces).
