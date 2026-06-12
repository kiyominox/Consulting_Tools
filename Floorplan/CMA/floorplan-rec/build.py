#!/usr/bin/env python3
"""Assemble the CMA-branded "Floorplan Reconciliation - CMA.html".

This is a *branding skin* over the store/group-agnostic tool in
`_shared/floorplan-rec/`. To keep one source of truth, it reuses the shared
template, application JS, and vendor libraries verbatim, applying only Carter
Myers Automotive branding (logo badge, navy/orange palette, titles) on top —
then inlines the libraries exactly like the shared build, producing a single
self-contained offline file.

Usage:  python3 build.py

If a branding anchor below stops matching (because the shared template changed),
the script aborts loudly rather than shipping an unbranded file — re-sync the
anchor with the shared template and rebuild.
"""
import pathlib, sys

CMA = pathlib.Path(__file__).parent
SHARED = CMA / ".." / ".." / "_shared" / "floorplan-rec"
OUTPUT_NAME = "Floorplan Reconciliation - CMA.html"


def read(p):
    return p.read_text(encoding="utf-8")


def must_replace(text, old, new, label):
    if text.count(old) != 1:
        sys.exit(f"ERROR: branding anchor '{label}' matched {text.count(old)} times (expected 1). "
                 f"Re-sync build.py with the shared template.")
    return text.replace(old, new)


# ---------------------------------------------------------------- CMA assets
# Inline SVG badge — Carter Myers Automotive centennial logo, recreated as
# vector art so it stays crisp and fully offline (no external image).
CMA_BADGE = (
    '<svg class="cma-mark" viewBox="0 0 100 100" width="34" height="34" role="img" aria-label="Carter Myers Automotive">'
    '<defs>'
    '<path id="cmaTop" d="M 50 50 m -39 0 a 39 39 0 1 1 78 0" fill="none"/>'
    '<path id="cmaBot" d="M 50 50 m -33 0 a 33 33 0 1 0 66 0" fill="none"/>'
    '</defs>'
    '<circle cx="50" cy="50" r="49" fill="#13294B"/>'
    '<circle cx="50" cy="50" r="46" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.5"/>'
    '<circle cx="50" cy="50" r="33" fill="#C8502A"/>'
    '<text fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="7" letter-spacing="0.4">'
    '<textPath href="#cmaTop" startOffset="50%" text-anchor="middle">CARTER MYERS AUTOMOTIVE</textPath></text>'
    '<text fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="8.5" letter-spacing="1.4">'
    '<textPath href="#cmaBot" startOffset="50%" text-anchor="middle">100 YEARS</textPath></text>'
    '<text x="50" y="52" text-anchor="middle" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" '
    'font-weight="800" font-size="22" letter-spacing="0.5">CMA</text>'
    '<text x="50" y="64" text-anchor="middle" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" '
    'font-weight="600" font-size="7.5">1924&#8211;2024</text>'
    '</svg>'
)

CMA_BRAND_BLOCK = (
    '<div class="brand">\n'
    '    ' + CMA_BADGE + '\n'
    '    <div>\n'
    '      <h1>Floorplan Reconciliation</h1>\n'
    '      <div class="sub">Carter Myers Automotive &middot; bank floorplan statement &harr; CDK schedule</div>\n'
    '    </div>\n'
    '  </div>'
)


def main():
    template = read(SHARED / "src" / "index.template.html")

    # ---- branding skin (applied before inlining) ----
    template = must_replace(template,
        "<title>Floorplan Reconciliation</title>",
        "<title>Floorplan Reconciliation — CMA</title>", "title")

    template = must_replace(template,
        "    --accent:#1f74cf; --accent-strong:#175ca8; --accent-ink:#0f4d8f;\n"
        "    --accent-soft:#e8f1fb; --accent-line:#c4ddf5;",
        "    --accent:#13294B; --accent-strong:#0e1f39; --accent-ink:#13294B;\n"
        "    --accent-soft:#eaeef5; --accent-line:#c2cee0; --cma-orange:#C8502A;",
        "accent palette")

    template = must_replace(template,
        '<div class="brand">\n'
        '    <div class="mark"></div>\n'
        '    <div>\n'
        '      <h1>Floorplan Reconciliation</h1>\n'
        '      <div class="sub">Bank floorplan statement &harr; CDK floorplan schedule &middot; offline</div>\n'
        '    </div>\n'
        '  </div>',
        CMA_BRAND_BLOCK, "brand block")

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

    (CMA / OUTPUT_NAME).write_text(out, encoding="utf-8")
    print(f"Built {OUTPUT_NAME!r} ({len(out):,} bytes)")


if __name__ == "__main__":
    main()
