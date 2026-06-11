# Nicole's Consulting Tools

A collection of CDK consulting tools organized by tool type.

## Structure

```
<ToolType>/
  _shared/          ← tools that apply across all stores/groups
  <store-or-group>/ ← store- or group-specific variants
```

Current tool types:

| Folder | Contents |
|---|---|
| `AP/` | Accounts Payable tools (coming soon) |
| `AR/` | Cash Clearing reconciliation template (CMA) |
| `GL-Reconciliation/` | GL Posting Validator |
| `Parts/` | Parts Inventory Reconciliation |
| `Powerposting/` | Powerposting tools (coming soon) |
| `Vehicle-Sales/` | Vehicle Sales Report Generator |
| `Documentation/` | Reference documents and quick guides |

## Tools

### GL-Reconciliation/_shared/GL-Posting-Validator
Standalone HTML tool for validating GL postings.

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
