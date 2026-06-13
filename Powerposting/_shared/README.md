# Powerposting (master / `_shared`)

Two offline single-file tools that turn a dropped **PDF** into **CDK AGJE Expert
Mode** posting strings. These are the de-branded **masters**, themed in the
master purple (`#6B298C`) so you can tell they're the source copies. pdf.js is
inlined, so they run fully offline (no network).

- **`Invoice_to_CDK_PowerPosting.html`** — Honda / Hyundai factory invoices →
  posting strings (control = last 6 of VIN, amounts forced negative).
- **`Warranty_Claims_to_CDK_PowerPosting.html`** — Toyota / GM warranty claim
  statements → posting strings with an auto-balancing line.

## Making it agnostic / iterating

The per-dealer data is isolated near the top of each tool's script in a block
marked **`MASTER CONFIG (edit per dealer)`**:

- Invoice: `HONDA_CO` / `HYUNDAI_CO` company numbers and the `HONDA_ACCT` /
  `HYUNDAI_ACCT` GL-account maps.
- Warranty: `CO` company number, the `ACCT` map, and `BAL_CTRL` balance controls.

The shipped values are **example defaults** — edit them for your store, then use
this file, or clone the folder per store with `/new-store-tool`. To add a whole
new brand/document layout, use `/add-powerposting-brand` (each brand is parsed by
its own `parse<Brand>()` function dispatched from the brand selector).

The per-brand badge colors (Honda red, Hyundai navy, Toyota red, GM blue) are
intentionally kept so rows stay visually distinguishable by brand; only the app
chrome (header, primary buttons, selection) uses the purple master theme.
</content>
