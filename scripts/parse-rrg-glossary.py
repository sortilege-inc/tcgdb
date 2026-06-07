"""Parse the column-extracted RRG text into a structured glossary.

Strategy:
  - The glossary entries in the RRG begin on page 2 (right column) and end
    on page 23. Each entry begins with a short Title-case header line, then
    a body that runs until the next header. Bullet points are prefixed by ◊
    or h.
  - Some entries are spread across left/right column boundaries; we read
    each column as a contiguous stream and walk it line by line.
  - We accept a header iff: it's a short line (≤ 50 chars), starts with an
    uppercase ASCII letter, contains no terminal period, and matches a
    plausible header pattern (Title case with optional comma-separated
    synonyms).

Output: .tmp/rrg-glossary.json — a list of {header, body, source_page}.

Usage:  python -u scripts/parse-rrg-glossary.py
"""
from __future__ import annotations
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)
SRC = os.path.join(REPO_ROOT, ".tmp", "rules-text-columned.txt")
OUT = os.path.join(REPO_ROOT, ".tmp", "rrg-glossary.json")

# Glossary entries start on page 2 (Ability) and end on page 25 ("The letter X").
GLOSSARY_START_PAGE = 2
GLOSSARY_END_PAGE   = 25

# A header is a short line of mostly Title-case words, optionally with a
# comma-separated synonym list, no period.
HEADER_RE = re.compile(r"^[A-Z][A-Za-z'’()\- ]{0,60}(, [A-Z][A-Za-z'’()\- ]+){0,3}$")

# Some lines look like headers but are NOT — keep a deny list as we discover them.
NOT_HEADERS = {
    "Glossary", "Multiple Formats", "The Jade Rule", "The following is",
    "Rules Reference G", "Card Anatomy Key", "Clan C",
    "CRAB CLAN", "CRANE CLAN", "DRAGON CLAN", "LION CLAN",
    "PHOENIX CLAN", "SCORPION CLAN", "UNICORN CLAN",
    "IN TEXT ON CARD", "ATTACHMENT", "CHARACTER", "CHARACTER S",
    "Appendix I", "Appendix II", "Appendix III", "Appendix IV",
    "Framework Steps", "Action Windows", "Reactions and Interrupts",
    "Framework Details", "Conflict Resolution", "Phase Sequence Timing Chart",
    "Children of the Empire", "Disciples of the Void",
    "Dominion Cycle", "Elemental Cycle", "Inheritance Cycle",
    "Imperial Cycle", "Temptations Cycle",
    "Wrap-up", "Clarifications",
    # Common false positives (bullet continuations capitalized as sentence starts)
}

def iter_pages_columns(text: str):
    """Yield (page_num, column_text) pairs."""
    page_re = re.compile(r"=== PAGE (\d+)/\d+ ===")
    col_re  = re.compile(r"--- (LEFT|RIGHT) COLUMN ---")
    page = None
    buf = []
    col = None
    for line in text.splitlines():
        m_page = page_re.match(line)
        m_col = col_re.match(line)
        if m_page:
            if page is not None and col is not None:
                yield page, "\n".join(buf)
            page = int(m_page.group(1))
            col = None
            buf = []
        elif m_col:
            if col is not None:
                yield page, "\n".join(buf)
            col = m_col.group(1)
            buf = []
        else:
            buf.append(line)
    if page is not None and col is not None:
        yield page, "\n".join(buf)


def clean_header(line: str) -> str:
    """Strip column-bleed artifacts from header lines."""
    s = line.strip()
    # Trailing ◊ bullet (used by the facing column's body) sometimes hangs
    # into the gutter and gets picked up at line end.
    s = s.rstrip("◊").strip()
    # Trailing single letter from facing column ("Honor S" → "Honor")
    s = re.sub(r"\s+[A-Z]$", "", s).strip()
    return s


def looks_like_header(line: str) -> bool:
    s = clean_header(line)
    if not s or s in NOT_HEADERS:
        return False
    # Pre-allowed weird headers that contain typography our regex doesn't grok.
    if s in ('The word “Would”', 'The letter “X”'):
        return True
    if not HEADER_RE.match(s):
        return False
    # Reject single-letter alphabet markers ("A", "S", etc. used as section labels)
    if len(s) <= 2:
        return False
    # Headers don't end in conjunctions / particles (would-be sentence starts).
    if s.endswith((" and", " or", " the", " of", " to", " a", " an", " in", " on",
                   " at", " is", " as", " by", " with", " for", " from")):
        return False
    # Filter sentence-starters: only verb forms reliably indicate a sentence.
    # (Headers like "Winning a Conflict" contain " a " but ARE headers; only
    # verbs/auxiliaries like "is/are/was/were/has/have" reliably mark
    # mid-paragraph captures.)
    lower = s.lower()
    if " " in lower:
        BAD_TOKENS = (" is ", " are ", " was ", " were ", " has ", " have ",
                      " can ", " cannot ", " may ", " will ", " would ",
                      " that ")
        if any(b in f" {lower} " for b in BAD_TOKENS):
            return False
    # Reject lines starting with common sentence-starters. Note: 'The word'
    # and 'The letter' ARE real headers on page 25 — pre-allow those.
    if s in ('The word “Would”', 'The letter “X”'):
        return True
    SENTENCE_START = ("A ", "An ", "The ", "If ", "When ", "Each ", "During ",
                      "Some ", "While ", "Other ", "Unless ", "Whenever ", "For ",
                      "These ", "This ", "It ", "Players ", "After ", "Before ",
                      "Cards ", "No ", "Once ", "Any ", "All ", "By ", "Such ")
    if any(s.startswith(p) for p in SENTENCE_START):
        return False
    return True


def main() -> int:
    if not os.path.exists(SRC):
        print(f"ERROR: {SRC} not found. Run scripts/extract-rules-by-column.py first.", file=sys.stderr)
        return 1

    with open(SRC, encoding="utf-8") as fh:
        text = fh.read()

    streams = []  # list of (page, col_lines: list[str])
    for page, col_text in iter_pages_columns(text):
        if not (GLOSSARY_START_PAGE <= page <= GLOSSARY_END_PAGE):
            continue
        lines = [l.rstrip() for l in col_text.splitlines() if l.strip()]
        streams.append((page, lines))

    entries: list[dict] = []
    cur = None
    for page, lines in streams:
        for line in lines:
            if looks_like_header(line):
                if cur:
                    entries.append(cur)
                cur = {"header": clean_header(line), "body": [], "source_page": page}
            else:
                if cur is None:
                    continue
                cur["body"].append(line)
    if cur:
        entries.append(cur)

    # Post-process bodies into a single string each.
    for e in entries:
        body = " ".join(e["body"])
        body = re.sub(r"\s+", " ", body).strip()
        e["body"] = body

    # Deduplicate by header (last definition wins, since the same header sometimes
    # straddles columns and gets picked up twice with partial body).
    by_header: dict[str, dict] = {}
    for e in entries:
        h = e["header"]
        if h in by_header:
            # Keep the longer body
            if len(e["body"]) > len(by_header[h]["body"]):
                by_header[h] = e
        else:
            by_header[h] = e

    final = sorted(by_header.values(), key=lambda x: (x["source_page"], x["header"]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(final, fh, indent=2, ensure_ascii=False)
    print(f"wrote {len(final)} entries to {OUT}", flush=True)

    # Also emit a Markdown skeleton, sorted alphabetically, with page citations.
    md_out = os.path.join(REPO_ROOT, ".tmp", "rrg-glossary.md")
    by_alpha = sorted(by_header.values(), key=lambda x: x["header"].lower())
    with open(md_out, "w", encoding="utf-8") as fh:
        fh.write("# RRG glossary (extracted from L5R Rules Reference v17)\n\n")
        for e in by_alpha:
            fh.write(f"### {e['header']} *(RRG p. {e['source_page']})*\n\n")
            # Clean body: collapse to paragraphs, strip leading bullets
            body = e["body"]
            # Re-split bullets: ◊ marks a new bullet
            body = body.replace("◊", "\n- ")
            body = body.replace(" h ", "\n  - ")
            body = re.sub(r"\n[ \t]*\n+", "\n\n", body)
            fh.write(body.strip() + "\n\n")
    print(f"wrote markdown skeleton to {md_out}", flush=True)

    # Print the index for review
    for e in final:
        print(f"  p{e['source_page']:2d}  {e['header']}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
