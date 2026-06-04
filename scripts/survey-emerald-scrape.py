#!/usr/bin/env python3
"""Survey the EmeraldDB scrape sitting in ../../core/.

Resilient against Windows file locks: per slug we try the highest-suffix
copy first, then walk down to lower suffixes / bare if the higher copies
are locked or unreadable. Reports counts, schema shape, and a slug → cardId
match against data/cards/l5r-lcg/core-set.json.
"""
import os, re, json, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
CORE_DIR    = os.path.normpath(os.path.join(HERE, '..', '..', 'core'))
PROJ_CARDS  = os.path.normpath(os.path.join(HERE, '..', 'data', 'cards', 'l5r-lcg', 'core-set.json'))

def pick_candidates_per_slug():
    """Return {slug: [filename, …]} ordered most-recent first per the user's rule
    (highest numeric suffix wins; bare comes last)."""
    by_slug = {}
    for f in os.listdir(CORE_DIR):
        if not f.endswith('.json'): continue
        m = re.match(r'^(.*?)(?: \((\d+)\))?\.json$', f)
        if not m: continue
        base = m.group(1)
        num  = int(m.group(2)) if m.group(2) else -1
        by_slug.setdefault(base, []).append((num, f))
    for slug in by_slug:
        by_slug[slug].sort(reverse=True)        # highest suffix first
    return {s: [f for _, f in v] for s, v in by_slug.items()}

def read_winner(candidates, attempts=()):
    """Try each candidate in order. Returns (data, filename_used) or
    (None, None) if all candidates are unreadable."""
    for c in candidates:
        path = os.path.join(CORE_DIR, c)
        try:
            with open(path, 'r', encoding='utf-8') as fh:
                return json.load(fh), c
        except PermissionError:
            attempts and attempts.append((c, 'PermissionError'))
            continue
        except OSError as e:
            attempts and attempts.append((c, e.__class__.__name__))
            continue
        except json.JSONDecodeError as e:
            attempts and attempts.append((c, f'json: {e}'))
            continue
    return None, None

def main():
    if not os.path.isdir(CORE_DIR):
        print(f'ERROR: core directory not found at {CORE_DIR}', file=sys.stderr)
        sys.exit(1)

    candidates = pick_candidates_per_slug()
    print(f'unique slugs in scrape: {len(candidates)}', flush=True)

    # Read every slug (with fallbacks)
    winners = {}                  # slug → data
    chosen_file = {}              # slug → filename actually used
    unreadable = []               # slug → (file, error)
    fallback_used = []            # slug whose top candidate failed but a lower one worked
    fields_seen = set()

    start = time.time()
    for i, (slug, cands) in enumerate(candidates.items(), 1):
        attempts = []
        d, fname = read_winner(cands, attempts)
        if d is None:
            unreadable.append((slug, attempts))
            continue
        winners[slug] = d
        chosen_file[slug] = fname
        fields_seen.update(d.keys())
        if fname != cands[0]:
            fallback_used.append((slug, cands[0], fname))
        if i % 50 == 0:
            print(f'  …{i}/{len(candidates)} ({time.time()-start:.1f}s)', flush=True)

    print(f'\nread {len(winners)}/{len(candidates)} winners', flush=True)
    print(f'  fallback used (top copy locked, lower copy worked): {len(fallback_used)}', flush=True)
    print(f'  unreadable (all copies failed): {len(unreadable)}', flush=True)
    for slug, attempts in unreadable[:10]:
        print(f'    {slug}: {attempts}', flush=True)

    # Schema
    print(f'\ndistinct top-level fields seen: {sorted(fields_seen)}', flush=True)
    print('\nfield population %:', flush=True)
    n = max(1, len(winners))
    for f in sorted(fields_seen):
        have = sum(1 for d in winners.values() if d.get(f) not in (None, '', [], {}))
        print(f'   {f:24s} {have:3d}/{n} ({100*have/n:.0f}%)', flush=True)

    # Match against existing core-set
    with open(PROJ_CARDS, 'r', encoding='utf-8') as fh:
        existing = json.load(fh)
    by_cardid = {c['id']: c for c in existing}

    matched_ids = set()
    matched_by_collector = 0
    unmatched_collector = []
    for slug, d in winners.items():
        cn = d.get('collectorNumber')
        if cn is None:
            unmatched_collector.append((slug, 'no collectorNumber'))
            continue
        cid = f'core-set-{int(cn):03d}'
        if cid in by_cardid:
            matched_ids.add(cid)
            matched_by_collector += 1
        else:
            unmatched_collector.append((slug, f'no record for {cid}'))

    # Fallback: name-based recovery for unmatched
    by_name = {c['name'].lower(): c['id'] for c in existing}
    recovered = []
    still_unmatched = []
    for slug, reason in unmatched_collector:
        nm = winners[slug].get('name', '').lower()
        if nm in by_name and by_name[nm] not in matched_ids:
            recovered.append((slug, by_name[nm]))
            matched_ids.add(by_name[nm])
        else:
            still_unmatched.append((slug, reason))

    print(f'\nmatch summary:', flush=True)
    print(f'   matched by collectorNumber: {matched_by_collector}', flush=True)
    print(f'   recovered via name match:   {len(recovered)}', flush=True)
    print(f'   scrape slugs unmatched:     {len(still_unmatched)}', flush=True)
    for s, r in still_unmatched[:20]:
        print(f'      {s}  ({r})', flush=True)

    not_covered = sorted(set(by_cardid.keys()) - matched_ids)
    print(f'\n   existing cards not in scrape: {len(not_covered)}', flush=True)
    for c in not_covered[:30]:
        print(f'      {c}  ({by_cardid[c]["name"]})', flush=True)

if __name__ == '__main__':
    main()
