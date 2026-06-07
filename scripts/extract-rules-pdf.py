"""Extract text from the L5R Rules Reference PDF with progress markers +
per-page fail-safe. Used to build / refresh the rules-text corpus that the
l5r-rules skill is distilled from.

Usage:  python -u scripts/extract-rules-pdf.py
"""
from __future__ import annotations
import os
import sys
import time

# Repo-rooted paths so the script works regardless of cwd.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)
SRC = os.path.join(REPO_ROOT, "docs", "l5r-rules-reference-v17.pdf")
OUT = os.path.join(REPO_ROOT, ".tmp", "rules-text.txt")

def main() -> int:
    try:
        import pdfplumber  # type: ignore[import-not-found]
    except ImportError:
        print("pdfplumber not installed; falling back to pypdf", flush=True)
        return _via_pypdf()

    start = time.monotonic()
    print(f"opening {SRC} with pdfplumber...", flush=True)
    with pdfplumber.open(SRC) as pdf:
        total = len(pdf.pages)
        print(f"pages: {total}", flush=True)
        if total == 0:
            print("empty pdf", flush=True)
            return 1
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        with open(OUT, "w", encoding="utf-8") as fh:
            errors = 0
            for i, page in enumerate(pdf.pages, 1):
                try:
                    text = page.extract_text() or ""
                except Exception as e:
                    errors += 1
                    text = f"[EXTRACT ERROR: {type(e).__name__}: {e}]"
                fh.write(f"\n\n=== PAGE {i}/{total} ===\n\n")
                fh.write(text)
                if i % 5 == 0 or i == total:
                    elapsed = time.monotonic() - start
                    print(f"  [{i}/{total}] elapsed={elapsed:.1f}s errors={errors}", flush=True)
    print(f"done -> {OUT}", flush=True)
    return 0

def _via_pypdf() -> int:
    from pypdf import PdfReader  # type: ignore[import-not-found]
    start = time.monotonic()
    print(f"opening {SRC} with pypdf...", flush=True)
    reader = PdfReader(SRC)
    total = len(reader.pages)
    print(f"pages: {total}", flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        errors = 0
        for i, page in enumerate(reader.pages, 1):
            try:
                text = page.extract_text() or ""
            except Exception as e:
                errors += 1
                text = f"[EXTRACT ERROR: {type(e).__name__}: {e}]"
            fh.write(f"\n\n=== PAGE {i}/{total} ===\n\n")
            fh.write(text)
            if i % 5 == 0 or i == total:
                elapsed = time.monotonic() - start
                print(f"  [{i}/{total}] elapsed={elapsed:.1f}s errors={errors}", flush=True)
    print(f"done -> {OUT}", flush=True)
    return 0

if __name__ == "__main__":
    sys.exit(main())
