# CLAUDE.md

Guidance for AI assistants (Claude Code, Opus, Sonnet) working in this repo.
This file is the **map and the house rules**; deep domain detail lives in
`docs/reference/` — read those packs when a task touches AGJE strings, export
formats, or per-store account numbers.

> See `README.md` for the human-facing index. This file does not duplicate it.

## What this repo is

A collection of **consulting tools for CDK-based automotive dealership
accounting**. Each tool ingests a CDK (or vendor/processor) export and either
reconciles it or turns it into **AGJE Expert Mode** posting strings that get
pasted back into CDK Drive. The audience is dealership controllers/office
managers. Tools must be trustworthy with real money and real GL accounts.

## Repo map & the `_shared`/`<store>` convention

```
<ToolType>/
  _shared/<tool>/      ← source of truth: the tool that applies to all stores
  <store-or-group>/<tool>/  ← a per-store/per-group variant (customized accounts)
```

| Tool type | Source | Live variants |
|---|---|---|
| `AR/` Cash Clearing | `AR/CMA/cash-clearing/` (HTML + 5 `.xlsm` templates) | Stores **CO18, CO19, CO20, CO21, CO23** |
| `Powerposting/` PDF→AGJE | `Powerposting/CMA/*.html` | Honda/Hyundai invoices; Toyota/GM warranty |
| `Vehicle-Sales/` report | `Vehicle-Sales/_shared/vehicle-sales-report/` (built from `src/`) | **MacDonald, Hillside** |
| `Parts/` reconciliation | `Parts/_shared/parts-rec/` (Python CLI + Flask + standalone HTML) | `_shared` only so far |
| `GL-Reconciliation/` validator | `GL-Reconciliation/Hickman's/gl-posting-validator.html` | Hickman's |
| `AP/` | placeholder — coming soon | — |

When adding a tool: all-stores → `<ToolType>/_shared/<tool-name>/`; store-specific
→ `<ToolType>/<store>/<tool-name>/`. Use hyphenated folder names, no spaces.

## House conventions for tools (follow these for anything new)

- **Single-file, offline, no-install.** Deliverables are one `.html` file the
  user double-clicks. **No network calls — ever.** The data (financials, PDFs)
  must never leave the machine. This is a hard requirement, not a preference.
- **Libraries are inlined, not loaded from a CDN.** SheetJS (`xlsx.full.min.js`)
  for reading `.xlsx/.xlsm`; ExcelJS (`exceljs.min.js`) for writing styled
  `.xlsx`. They live in `vendor/` in the source and get inlined at build time.
- **`localStorage` persistence** so a user can close and resume; plus a
  **JSON export/import** to back up or move between machines.
- **Inputs by drag-drop** (CSV/TSV/TXT/XLSX/XLSM); locate columns by **header
  name**, not fixed position, because vendors reorder columns.
- **Exports:** AGJE posting text (copy-to-clipboard + `.txt`), a print/PDF
  record, and a styled `.xlsx`. Reconciliation tools show a live
  Deposit/Received/Variance header that turns green at `0.00`.
- **"Download shareable copy"** pattern: a tool can regenerate its own HTML with
  the current per-store settings baked in as new defaults, to hand to a coworker.

## Build pattern (source → single file)

Tools assembled from `src/` use a Python `build.py` that inlines the vendor libs
and `src/*.js` into an HTML template via `/*__MARKER__*/` placeholders, then
writes the standalone file. Reference implementation:
`Vehicle-Sales/_shared/vehicle-sales-report/build.py`.

- The template must contain **exactly one** of each marker.
- The build **aborts if any injected source contains a literal `</script>`** (it
  would break the inlined `<script>` block). Never introduce one.
- **Never hand-edit a built artifact** (e.g. `Vehicle Sales Report.html`); edit
  `src/` and rebuild with `python3 build.py`. See `/build-tool`.

## AGJE Expert Mode — the core output format

CDK AGJE Expert Mode posting string:

```
Co.Account.(Amount×100).Control.Control2.Description.Count
```

The amount is **multiplied by 100** so it carries no decimal point. In CDK's
AGJE Expert Mode you **right-click → Paste** (Ctrl+V does not work there). Full
field-by-field spec, sign conventions, and worked examples per brand/tool:
**`docs/reference/agje-expert-mode-format.md`**.

## Glossary (one-liners; full version in the reference pack)

- **CDK / CDK Drive** — the dealership DMS/accounting system; source of most exports.
- **AGJE** — Accounting General Journal Entry; Expert Mode takes the posting strings above.
- **Deskit** — sales desking system; cross-reference for vehicle-sales deals (joined on stock #).
- **Control / Control2** — sub-ledger reference fields on a GL posting (VIN, RO#, etc.).
- **RAD** — used in parts rec; a monthly figure summed YTD (Jan→rec month).
- **MGR / Fast Lane / recap** — CDK parts/inventory reports feeding parts rec.
- **NOS** — "Not On Schedule" items in cash clearing (unmatched deposits routed by category).
- **RO** — Repair Order number (a common control value).

Full glossary: **`docs/reference/dealership-accounting-glossary.md`**.

## Reference packs (read before deep work)

- `docs/reference/agje-expert-mode-format.md` — the posting-string spec + per-tool examples.
- `docs/reference/cdk-and-vendor-exports.md` — every input file format and its column quirks.
- `docs/reference/account-control-maps.md` — per-store account/control/settlement maps.
- `docs/reference/dealership-accounting-glossary.md` — domain terms.

## Slash commands (repeated workflows)

- `/new-store-tool` — clone a `_shared` tool for a new store and swap its account maps.
- `/update-export-format` — adapt a tool when CDK/a processor changes a report layout.
- `/build-tool` — rebuild a single-file HTML artifact from `src/` and validate it.
- `/add-powerposting-brand` — add a new brand/document parser to a Powerposting tool.
- `/new-html-tool` — scaffold a brand-new offline single-file HTML tool to house style.

## Working norms

- **Accuracy over guessing.** Account numbers, controls, and AGJE formats are
  real and must trace to existing tool code or the reference packs. If a value
  can't be sourced, say so and ask — never invent a GL account.
- **Preserve offline guarantees.** Any change that would add a network
  dependency to a tool is a regression; flag it instead of shipping it.
- **Match the surrounding tool's style** (vanilla JS, header-based column
  lookup, editable tables with live AGJE preview).
- Test by opening the built HTML in a browser and using its **sample-data**
  button before claiming a tool works.
