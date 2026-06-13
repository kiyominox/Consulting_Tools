# Floorplan Reconciliation — CMA

Carter Myers Automotive-branded build of the floorplan reconciliation tool. The
deliverable is **`Floorplan Reconciliation - CMA.html`** — same single-file,
fully-offline tool as `_shared/floorplan-rec/`, just skinned with the CMA logo
badge, navy/orange palette, and a "Carter Myers Automotive" header so it doesn't
look like a blank generic tool when handed to a controller.

**The logic is identical to the shared tool** — see
[`../../_shared/floorplan-rec/README.md`](../../_shared/floorplan-rec/README.md)
for what it does (store/group-agnostic VIN matching, floorplan-account
detection, Excel/CSV/PDF inputs, variance reporting, exports).

## Building

```
python3 build.py      # → "Floorplan Reconciliation - CMA.html"
```

This is a **branding skin, not a fork**. `build.py` reads the shared template,
`src/app.js`, and `vendor/` libraries from `../../_shared/floorplan-rec/`, then
applies only the CMA branding (logo, palette, titles) before inlining. There is
no duplicated application code — fix bugs and add features in `_shared`, then
rebuild here. The CMA logo is recreated as inline SVG, so the file stays offline
with no external image. If the shared template changes shape, the build aborts
with a clear message rather than shipping an unbranded file.
