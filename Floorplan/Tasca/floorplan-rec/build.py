#!/usr/bin/env python3
"""Assemble the Tasca-branded "Floorplan Reconciliation - Tasca.html".

This is a *branding skin* over the store/group-agnostic tool in
`_shared/floorplan-rec/`. To keep one source of truth, it reuses the shared
template, application JS, and vendor libraries verbatim, applying only Tasca
Automotive Group branding (logo badge, red palette, titles) on top — then
inlines the libraries exactly like the shared build, producing a single
self-contained offline file.

Usage:  python3 build.py

Logo: if a `tasca-logo.png` sits next to this script it is embedded as a base64
data URI (faithful to the real glossy chrome/red oval). Otherwise the build
falls back to an inline-SVG recreation of the TASCA oval so the file always
stays single-file and fully offline. Drop the official PNG in to upgrade.

If a branding anchor below stops matching (because the shared template changed),
the script aborts loudly rather than shipping an unbranded file — re-sync the
anchor with the shared template and rebuild.
"""
import base64, pathlib, sys

TASCA = pathlib.Path(__file__).parent
SHARED = TASCA / ".." / ".." / "_shared" / "floorplan-rec"
OUTPUT_NAME = "Floorplan Reconciliation - Tasca.html"
LOGO_PNG = TASCA / "tasca-logo.png"


def read(p):
    return p.read_text(encoding="utf-8")


def must_replace(text, old, new, label):
    if text.count(old) != 1:
        sys.exit(f"ERROR: branding anchor '{label}' matched {text.count(old)} times (expected 1). "
                 f"Re-sync build.py with the shared template.")
    return text.replace(old, new)


# ---------------------------------------------------------------- Tasca assets
# Inline-SVG recreation of the Tasca red oval (chrome ring + glossy red wordmark),
# used as a fallback so the build never depends on an external image.
TASCA_SVG = (
    '<svg class="tasca-mark" viewBox="0 0 100 56" width="58" height="32" role="img" aria-label="Tasca">'
    '<defs>'
    '<linearGradient id="tChrome" x1="0" y1="0" x2="0" y2="1">'
    '<stop offset="0" stop-color="#fdfdfd"/><stop offset="0.5" stop-color="#9aa0a6"/>'
    '<stop offset="1" stop-color="#e8eaed"/></linearGradient>'
    '<linearGradient id="tRed" x1="0" y1="0" x2="0" y2="1">'
    '<stop offset="0" stop-color="#ff2a2a"/><stop offset="0.5" stop-color="#cc0000"/>'
    '<stop offset="1" stop-color="#8a0000"/></linearGradient>'
    '</defs>'
    '<ellipse cx="50" cy="28" rx="49" ry="27" fill="url(#tChrome)"/>'
    '<ellipse cx="50" cy="28" rx="45" ry="23" fill="#cc0000"/>'
    '<ellipse cx="50" cy="28" rx="42" ry="20.5" fill="#fff"/>'
    '<text x="50" y="38" text-anchor="middle" fill="url(#tRed)" '
    'font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" '
    'font-size="26" letter-spacing="1">TASCA</text>'
    '</svg>'
)


def logo_markup():
    if LOGO_PNG.exists():
        b64 = base64.b64encode(LOGO_PNG.read_bytes()).decode("ascii")
        return (f'<img class="tasca-mark" src="data:image/png;base64,{b64}" '
                f'alt="Tasca" height="32" style="height:32px;width:auto;display:block;flex:none">')
    return TASCA_SVG


TASCA_BRAND_BLOCK = (
    '<div class="brand">\n'
    '    ' + logo_markup() + '\n'
    '    <div>\n'
    '      <h1>Floorplan Reconciliation</h1>\n'
    '      <div class="sub">Tasca Automotive Group &middot; offline</div>\n'
    '    </div>\n'
    '  </div>'
)


def main():
    template = read(SHARED / "src" / "index.template.html")

    # ---- branding skin (applied before inlining) ----
    template = must_replace(template,
        "<title>Floorplan Reconciliation</title>",
        "<title>Floorplan Reconciliation — Tasca</title>", "title")

    template = must_replace(template,
        "    --accent:#6B298C; --accent-strong:#561f70; --accent-ink:#45195a;\n"
        "    --accent-soft:#f3eaf8; --accent-line:#dcc4e8;",
        "    --accent:#CC0000; --accent-strong:#990000; --accent-ink:#990000;\n"
        "    --accent-soft:#fdeaea; --accent-line:#f3c9c9;",
        "accent palette")

    template = must_replace(template,
        '<div class="brand">\n'
        '    <div class="mark"></div>\n'
        '    <div>\n'
        '      <h1>Floorplan Reconciliation</h1>\n'
        '      <div class="sub">Bank floorplan statement &harr; CDK floorplan schedule &middot; offline</div>\n'
        '    </div>\n'
        '  </div>',
        TASCA_BRAND_BLOCK, "brand block")

    # ---- inline libraries + app.js from the shared source (single source of truth) ----
    sheetjs = read(SHARED / "vendor" / "xlsx.full.min.js")
    exceljs = read(SHARED / "vendor" / "exceljs.min.js")
    pdfjs = read(SHARED / "vendor" / "pdf.min.js")
    pdfworker = read(SHARED / "vendor" / "pdf.worker.min.js")
    appjs = read(SHARED / "src" / "app.js")

    for name, blob in (("SheetJS", sheetjs), ("ExcelJS", exceljs), ("pdf.js", pdfjs),
                       ("pdf.worker", pdfworker), ("app.js", appjs)):
        if "</script" in blob.lower():
            sys.exit(f"ERROR: {name} contains a closing </script> tag and cannot be inlined.")

    for marker in ("/*__SHEETJS_LIB__*/", "/*__EXCELJS_LIB__*/", "/*__PDFJS_LIB__*/",
                   "/*__PDFWORKER_LIB__*/", "/*__APP_JS__*/"):
        if template.count(marker) != 1:
            sys.exit(f"ERROR: template must contain exactly one {marker}")

    out = (template
           .replace("/*__SHEETJS_LIB__*/", sheetjs)
           .replace("/*__EXCELJS_LIB__*/", exceljs)
           .replace("/*__PDFJS_LIB__*/", pdfjs)
           .replace("/*__PDFWORKER_LIB__*/", pdfworker)
           .replace("/*__APP_JS__*/", appjs))

    (TASCA / OUTPUT_NAME).write_text(out, encoding="utf-8")
    src = "tasca-logo.png" if LOGO_PNG.exists() else "inline-SVG fallback"
    print(f"Built {OUTPUT_NAME!r} ({len(out):,} bytes) — logo: {src}")


if __name__ == "__main__":
    main()
