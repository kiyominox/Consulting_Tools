---
description: Scaffold a brand-new offline single-file HTML tool to house style
argument-hint: <tool-type>/<name> — describe what it does
---

Create a new dealership tool that follows every house convention from the start.
Arguments: `$ARGUMENTS` (where it lives + what it does).

Before building, read `CLAUDE.md` (house conventions + build pattern) and the
relevant `docs/reference/` packs (AGJE format, export formats, account maps) so
the tool speaks the right formats.

Decide the shape:

- **Single self-contained file** (simplest): one `.html` with libraries inlined.
  Good default for a standalone tool.
- **`src/` + `build.py`** (for anything non-trivial or multi-source): template +
  `src/*.js` + `vendor/` libs, assembled by a `build.py` modeled on
  `Vehicle-Sales/_shared/vehicle-sales-report/build.py`. Use this if the tool has
  baked-in per-store defaults or substantial JS.

Non-negotiable house rules to bake in:

1. **Offline, no network calls — ever.** Data never leaves the machine. Inline
   SheetJS / ExcelJS from `vendor/`; never load from a CDN.
2. **Drag-drop uploads** (CSV/TSV/TXT/XLSX/XLSM); locate columns **by header
   name**, normalize references, detect the header row.
3. **`localStorage` persistence** + **JSON export/import** to back up / move
   machines.
4. **Exports**: AGJE text (clipboard + `.txt`) where postings apply, a print/PDF
   record, and a styled `.xlsx`. Reconciliation tools show a live
   Deposit/Received/Variance header that turns green at `0.00`.
5. **Sample-data button** so the tool can be tested/trained without real files.
6. If per-store, support the **"Download shareable copy"** pattern (regenerate the
   HTML with current settings baked in as defaults).
7. AGJE strings must match `Co.Account.(Amount×100).Control.Control2.Desc.Count`.

Placement: all-stores → `<ToolType>/_shared/<name>/`; store-specific →
`<ToolType>/<store>/<name>/`. Add a README modeled on the existing tool READMEs.

Verify by opening the file in a browser and exercising the sample-data path; if
it uses `build.py`, run `/build-tool` and confirm the guards pass.
