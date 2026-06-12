---
description: Adapt a tool when CDK or a processor changes a report/export layout
argument-hint: <tool> — describe what changed (new columns/headers)
---

A vendor (CDK or a card processor) changed an export layout and a tool needs to
read the new format. Arguments/context: `$ARGUMENTS`.

This is the workflow that handled the **June 2026 credit-card processor switch**
in cash clearing (reference → `RO#/Other` col C, amount → `Sale Amount` col E,
brand → `Card` col G). Use that as the model.

Steps:

1. **Pin down the change.** Get the old vs new column names/positions from the
   user (or a sample file). Update `docs/reference/cdk-and-vendor-exports.md`
   with the new mapping and keep the old one noted for history.

2. **Find the column-mapping logic.** Tools locate columns **by header name**.
   Search the tool source for the old header strings and the parsing/matching
   functions (e.g. the cash-clearing `On CC Stmnt` match, the Notes/brand lookup,
   the UNFOUND / `PopulateNotOnSchedule` routine).

3. **Update the mapping**, keeping these invariants:
   - Match by header text, not fixed position.
   - **Normalize** reference values (trim, case-fold, numeric-vs-text agnostic).
   - Detect the header row rather than assuming row 1; respect title rows.
   - Surface blank-reference rows for manual review (don't silently drop).

4. **Rebuild** if the tool is assembled from `src/` (see `/build-tool`).

5. **Test with sample data.** Use the tool's built-in sample / "Generate using
   sample data" path, and ideally a real exported file from the user, to confirm
   references match and totals reconcile to `0.00`.

6. **Update the tool's README** describing the format change (as the cash
   clearing README documents the June 2026 processor migration).

Never add a network call. Keep the tool single-file and offline.
