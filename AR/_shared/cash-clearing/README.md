# Cash Clearing Reconciliation (master / `_shared`)

This folder holds **two** offline masters that share the same v1.7 engine, store
config, and AGJE/JE output — pick whichever UI you prefer:

- **`Cash_Clearing_Reconciliation.html`** — the workbook-style layout (described
  below).
- **`Deposit_Reconciliation_Standalone.html`** — the redesigned "Daily Deposit
  Reconciliation" UI (left rail, store selector, five numbered steps). Same
  engine/output; de-branded, purple-themed, dark-mode toggle, the same five
  fictional demo stores and sample data, and keyboard navigation. Per-store data
  is edited the same way (Setup + Download shareable copy). Because this layout is
  heavily inline-styled, give dark mode a quick browser check.

Daily cash-deposit posting / reconciliation, ported from the CMA workbook into a
single offline HTML file. This is the **store-agnostic master**: themed in the
master purple (`#6B298C`) and pre-loaded with **fictional** demo stores so it's
obviously the source copy, not a live store build.

## Making it agnostic

All per-store data lives in one editable place — the `#defaultConfig` JSON block
(clearing account, deposit types → accounts + control prefixes, and
Not-On-Schedule categories per store). Edit it through the **⚙ Setup** screen, or
by hand, then use **Download shareable copy** to bake your settings back into a
fresh HTML file to hand to a coworker or seed a per-store build.

The demo config ships five imaginary stores (Hill Valley Honda, Bedrock Hyundai,
Springfield Subaru, Gotham Toyota-Chevrolet, Duckburg CDJR) with placeholder
account numbers. Replace these with the real store(s) in Setup — or clone this
folder per store with `/new-store-tool` and swap the accounts.

## Workflow

Import the CDK Cash Clearing schedule plus the processor settlement reports
(card/cash/check, additive drag-drop). Columns are located by header name
(`RO#/Other`, `Sale Amount`, `Card`, …). CC items auto-match per control
(green = exact, amber = amount differs); unmatched items drop into an editable
Not-On-Schedule list. A live Deposit/Received/Variance header turns green at
`0.00`. Export AGJE posting lines (clipboard or `.txt`), a PDF record, a styled
`.xlsx`, or a JSON session.

**Generate using sample data** loads a balanced fictional example (Gotham
Toyota-Chevrolet, customers like Homer Simpson and Bruce Wayne) for
testing/training without real files.
</content>
