# Floorplan Reconciliation — Tasca

Tasca Automotive Group-branded build. See
[../../_shared/floorplan-rec/README.md](../../_shared/floorplan-rec/README.md)
for full tool details — the reconciliation logic is identical, only the branding
(logo, red palette, titles) differs.

## Building

```bash
python3 build.py      # → "Floorplan Reconciliation - Tasca.html"
```

This is a *branding skin* over `_shared/floorplan-rec/`: it reuses the shared
template, `app.js`, and vendor libraries verbatim and applies Tasca branding on
top, then inlines everything into a single offline `.html`. Fixes and features
land in `_shared/`; just rebuild here afterward.

If the shared template's anchors (title, accent palette, brand block) change, the
build **aborts** rather than shipping an unbranded file — re-sync the anchors in
`build.py` and rebuild.

## Logo

If `tasca-logo.png` is present next to `build.py`, it is embedded as a base64 data
URI (faithful to the official glossy chrome/red oval). Without it, the build falls
back to an inline-SVG recreation of the TASCA oval. Either way the output stays
single-file and fully offline. Drop the official PNG in to upgrade the badge.

## Per-store config

None. The Floorplan Reconciliation tool is store/group-agnostic — it auto-detects
GL accounts, VIN columns, and floorplan balances at runtime, so no account map
needs to be swapped for Tasca.
