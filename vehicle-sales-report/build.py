#!/usr/bin/env python3
"""Assemble the standalone vehicle-sales-report/index.html.

Injects the SheetJS library, the MacDonald default chart-of-accounts, and the
application JS into the HTML template, producing a single self-contained file
that runs offline with no server or network access.

Usage:  python3 build.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"

def read(p):
    return p.read_text(encoding="utf-8")

def main():
    template = read(SRC / "index.template.html")
    sheetjs  = read(ROOT / "vendor" / "xlsx.full.min.js")
    macdef   = read(SRC / "mac_defaults.js")
    appjs    = read(SRC / "app.js")

    for name, blob in (("SheetJS", sheetjs), ("MAC defaults", macdef), ("app.js", appjs)):
        if "</script" in blob.lower():
            sys.exit(f"ERROR: {name} contains a closing </script> tag and cannot be inlined.")

    for marker in ("/*__SHEETJS_LIB__*/", "/*__MAC_DEFAULTS__*/", "/*__APP_JS__*/"):
        if template.count(marker) != 1:
            sys.exit(f"ERROR: template must contain exactly one {marker}")

    out = (template
           .replace("/*__SHEETJS_LIB__*/", sheetjs)
           .replace("/*__MAC_DEFAULTS__*/", macdef)
           .replace("/*__APP_JS__*/", appjs))

    (ROOT / "index.html").write_text(out, encoding="utf-8")
    print(f"Built index.html ({len(out):,} bytes)")

if __name__ == "__main__":
    main()
