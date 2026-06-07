"""Extract L5R rules text respecting the PDF's two-column layout.

The default pdfplumber extract_text() interleaves the columns line-by-line,
which makes glossary entries (which are alphabetical headers in the left
column followed by definition text in the right) look like noise. This
extractor splits each page into left and right halves by x-coordinate
and reads them as separate streams.

Usage:  python -u scripts/extract-rules-by-column.py
Output: .tmp/rules-text-columned.txt
"""
from __future__ import annotations
import os
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)
SRC = os.path.join(REPO_ROOT, "docs", "l5r-rules-reference-v17.pdf")
OUT = os.path.join(REPO_ROOT, ".tmp", "rules-text-columned.txt")


def main() -> int:
    import pdfplumber  # type: ignore[import-not-found]

    start = time.monotonic()
    print(f"opening {SRC} with pdfplumber (column-aware)...", flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)

    with pdfplumber.open(SRC) as pdf, open(OUT, "w", encoding="utf-8") as fh:
        total = len(pdf.pages)
        print(f"pages: {total}", flush=True)
        errors = 0
        for i, page in enumerate(pdf.pages, 1):
            fh.write(f"\n\n=== PAGE {i}/{total} ===\n\n")
            try:
                width = float(page.width)
                # The body is ~50/50 split; gutter sits roughly mid-page.
                # Use 0.5 * width as the split, with a small allowance for the
                # ◊ bullet character that hangs into the gutter.
                left  = page.crop((0, 0, width * 0.5 + 6, page.height))
                right = page.crop((width * 0.5 - 6, 0, width, page.height))
                left_text  = left.extract_text() or ""
                right_text = right.extract_text() or ""
                fh.write("--- LEFT COLUMN ---\n")
                fh.write(left_text)
                fh.write("\n--- RIGHT COLUMN ---\n")
                fh.write(right_text)
            except Exception as e:
                errors += 1
                fh.write(f"[EXTRACT ERROR: {type(e).__name__}: {e}]")
            if i % 5 == 0 or i == total:
                elapsed = time.monotonic() - start
                print(f"  [{i}/{total}] elapsed={elapsed:.1f}s errors={errors}", flush=True)
    print(f"done -> {OUT}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
