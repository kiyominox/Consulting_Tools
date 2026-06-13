#!/usr/bin/env python3
"""Assemble the standalone "Floorplan Reconciliation.html".

Inlines the SheetJS (read) and ExcelJS (styled write) libraries and the
application JS into the HTML template, producing a single self-contained file
that runs fully offline with no server or network access. The financial data
(floorplan schedules and bank statements) never leaves the machine.

Usage:  python3 build.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
OUTPUT_NAME = "Floorplan Reconciliation.html"


def read(p):
    return p.read_text(encoding="utf-8")


def main():
    template = read(SRC / "index.template.html")
    sheetjs = read(ROOT / "vendor" / "xlsx.full.min.js")
    exceljs = read(ROOT / "vendor" / "exceljs.min.js")
    pdfjs = read(ROOT / "vendor" / "pdf.min.js")
    pdfworker = read(ROOT / "vendor" / "pdf.worker.min.js")
    appjs = read(SRC / "app.js")

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

    (ROOT / OUTPUT_NAME).write_text(out, encoding="utf-8")
    print(f"Built {OUTPUT_NAME!r} ({len(out):,} bytes)")


if __name__ == "__main__":
    main()
