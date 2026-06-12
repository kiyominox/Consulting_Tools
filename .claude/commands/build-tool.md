---
description: Rebuild a single-file HTML artifact from its src/ and validate it
argument-hint: <tool path> (defaults to vehicle-sales-report)
---

Rebuild a standalone HTML tool from its `src/` sources. Target: `$ARGUMENTS`
(default `Vehicle-Sales/_shared/vehicle-sales-report/`).

The build inlines the vendor libraries and `src/*.js` into the HTML template via
`/*__MARKER__*/` placeholders — see `build.py` in the target folder and the build
pattern in `CLAUDE.md`.

Steps:

1. **Never hand-edit the built artifact** (e.g. `Vehicle Sales Report.html`).
   Make changes in `src/` only.

2. **Run the build** from the tool's folder:
   ```bash
   python3 build.py
   ```

3. **Confirm the build's own guards pass** — it aborts if:
   - any injected source contains a literal `</script>` (would break the inlined
     `<script>` block), or
   - the template doesn't contain **exactly one** of each marker
     (`/*__SHEETJS_LIB__*/`, `/*__EXCELJS_LIB__*/`, `/*__MAC_DEFAULTS__*/`,
     `/*__APP_JS__*/`, etc.).
   If it aborts, fix the offending source and rerun — don't bypass the guard.

4. **Smoke-test the artifact:** open the rebuilt HTML in a browser and use its
   sample-data button (e.g. "Generate using sample data") to confirm it loads,
   parses, and exports without errors and with no network access.

5. Report the output filename and byte size (the build prints this).

If the target tool has no `build.py`, it's already single-file — say so instead
of inventing a build step.
