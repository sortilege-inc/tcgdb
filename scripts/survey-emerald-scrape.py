"""Survey EmeraldDB scrape files by `set` field.

Streams progress every 100 files (heartbeat every 5s minimum), catches per-file
errors with samples, and prints flush=True so the caller can tell whether the
script is making progress vs hung.

Usage:
    python scripts/survey-emerald-scrape.py <dir> [<dir> ...]
"""
from __future__ import annotations
import json
import os
import sys
import time
from collections import Counter


def survey_dir(path: str) -> tuple[Counter, int, list[str]]:
    counts: Counter = Counter()
    errors = 0
    error_samples: list[str] = []
    files = [f for f in os.listdir(path) if f.endswith('.json')]
    total = len(files)
    print(f'[{path}] scanning {total} json files', flush=True)
    if total == 0:
        return counts, 0, []

    # Smoke-test: read one file and time it. If a single read is slow, the
    # bulk run will be worse — surface that immediately, don't sit silent.
    first = os.path.join(path, files[0])
    smoke_start = time.monotonic()
    try:
        with open(first, encoding='utf-8') as fh:
            json.load(fh)
        smoke_ms = (time.monotonic() - smoke_start) * 1000
        print(f'  smoke test: {files[0]} read in {smoke_ms:.0f}ms', flush=True)
        if smoke_ms > 2000:
            print(f'  WARNING: smoke read took {smoke_ms:.0f}ms; bulk run may be slow', flush=True)
    except Exception as e:
        smoke_ms = (time.monotonic() - smoke_start) * 1000
        print(f'  smoke FAILED in {smoke_ms:.0f}ms: {type(e).__name__}: {e}', flush=True)
        # Continue anyway; one bad file isn't a verdict on the whole dir

    start = time.monotonic()
    last_heartbeat = start
    for i, f in enumerate(files, 1):
        full = os.path.join(path, f)
        try:
            with open(full, encoding='utf-8') as fh:
                d = json.load(fh)
            s = d.get('set') or '(none)'
            counts[s] += 1
        except Exception as e:
            errors += 1
            if len(error_samples) < 3:
                error_samples.append(f'{f}: {type(e).__name__}: {e}')
        now = time.monotonic()
        if i % 100 == 0 or (now - last_heartbeat) >= 5.0:
            elapsed = now - start
            rate = i / elapsed if elapsed > 0 else 0
            print(f'  [{i}/{total}] elapsed={elapsed:.1f}s rate={rate:.0f}/s errors={errors}',
                  flush=True)
            last_heartbeat = now

    elapsed = time.monotonic() - start
    print(f'[{path}] done: {total} files in {elapsed:.1f}s, {errors} errors', flush=True)
    return counts, errors, error_samples


def main() -> int:
    if len(sys.argv) < 2:
        print('usage: survey-emerald-scrape.py <dir> [<dir> ...]', file=sys.stderr)
        return 2
    grand_total: Counter = Counter()
    grand_errors = 0
    per_dir_samples: list[str] = []
    for d in sys.argv[1:]:
        if not os.path.isdir(d):
            print(f'[{d}] NOT A DIRECTORY — skipped', flush=True)
            continue
        counts, errors, samples = survey_dir(d)
        for s, n in counts.items():
            grand_total[s] += n
        grand_errors += errors
        for sample in samples:
            per_dir_samples.append(f'{d}: {sample}')
    print('', flush=True)
    print('=== combined sets ===', flush=True)
    for s, n in grand_total.most_common():
        print(f'  {n:5d}  {s}', flush=True)
    if per_dir_samples:
        print('', flush=True)
        print('=== error samples ===', flush=True)
        for s in per_dir_samples:
            print(f'  {s}', flush=True)
    print(f'\ntotal errors: {grand_errors}', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
