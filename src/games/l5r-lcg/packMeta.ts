/**
 * L5R LCG pack (set) ordering + grouping metadata for deckbuilding.
 *
 * SOURCED — release order is not invented from memory. Canonical release
 * dates / positions were taken from:
 *   - FiveRingsDB pack data (Alsciende/fiveringsdb-data, json/Pack.json):
 *     authoritative for the Core Set, all 5 dynasty cycles (every pack),
 *     all 7 Clan Packs, and Children of the Empire — each with an exact
 *     `released` date and intra-cycle `position`.
 *   - Wikipedia "Legend of the Five Rings: The Card Game" for three
 *     premium expansions FiveRingsDB lacks: Children of the Empire
 *     (2019-02-14), Clan War (2020-02-07), Under Fu Leng's Shadow
 *     (2021-06-18, the final FFG release).
 *
 * NOT SOURCED (no reliable release date found on FiveRingsDB or Wikipedia):
 * the later Emerald-Legacy-era premium expansions + the Draft Pack —
 * `ancient-secrets`, `restoration-of-balance`, `shadows-of-doubt`,
 * `through-the-mists`, `under-the-empress-eyes`, `draft-pack`. These are
 * placed AFTER every dated set and ordered alphabetically among themselves,
 * flagged below. Re-source if exact dates surface.
 *
 * The tcgdb set ids below match `data/sets/l5r-lcg/*.json` (a few differ
 * from FiveRingsDB's ids, e.g. `a-champions-foresight` vs FRDB
 * `a-champion-s-foresight`).
 */

/**
 * tcgdb set ids in canonical release order. Index in this array == release
 * rank. Sets NOT listed here sort to the end (rank = Infinity), then by name.
 */
export const PACK_RELEASE_ORDER: readonly string[] = [
  // Core (2017-10-05)
  'core-set',
  // Imperial Cycle (2017-11 → 2017-12)
  'tears-of-amaterasu',
  'for-honor-and-glory',
  'into-the-forbidden-city',
  'the-chrysanthemum-throne',
  'fate-has-no-secrets',
  'meditations-on-the-ephemeral',
  // Clan Pack (2018-04-05)
  'disciples-of-the-void',
  // Elemental Cycle (2018-06 → 2018-08)
  'breath-of-the-kami',
  'tainted-lands',
  'the-fires-within',
  'the-ebb-and-flow',
  'all-and-nothing',
  'elements-unbound',
  // Clan Pack (2018-10-11)
  'underhand-of-the-emperor',
  // Premium (2019-02-14)
  'children-of-the-empire',
  // Clan Packs (2019-04)
  'warriors-of-the-wind',
  'masters-of-the-court',
  // Inheritance Cycle + interleaved Clan Packs (2019-06 → 2019-11)
  'for-the-empire',          // 2019-06-22
  'bonds-of-blood',          // 2019-07-19
  'justice-for-satsume',     // 2019-08-01
  'the-emperors-legion',     // 2019-09-01 (clan pack)
  'the-children-of-heaven',  // 2019-09-01
  'a-champions-foresight',   // 2019-10-01
  'defenders-of-rokugan',    // 2019-10-01 (clan pack)
  'shojus-duty',             // 2019-11-01
  'seekers-of-wisdom',       // 2019-11-01 (clan pack)
  // Premium (2020-02-07)
  'clan-war',
  // Dominion Cycle (2020-03 → 2020-10)
  'rokugan-at-war',
  'spreading-shadows',
  'in-pursuit-of-truth',
  'campaigns-of-conquest',
  'as-honor-demands',
  'atonement',
  // Temptations Cycle (2020-11 → 2021-04)
  'twisted-loyalties',
  'honor-in-flames',
  'a-crimson-offering',
  'the-temptation-of-the-scorpion',
  'coils-of-power',
  'peace-at-any-cost',
  // Premium (2021-06-18, final FFG release)
  'under-fu-lengs-shadow',
  // --- NOT SOURCED (alphabetical, appended) ---
  'ancient-secrets',
  'restoration-of-balance',
  'shadows-of-doubt',
  'through-the-mists',
  'under-the-empress-eyes',
  'draft-pack',
]

const RELEASE_RANK = new Map<string, number>(
  PACK_RELEASE_ORDER.map((id, i) => [id, i]),
)

/** Release rank for a set id (lower = earlier). Unknown ids sort last. */
export function releaseRank(setId: string): number {
  return RELEASE_RANK.get(setId) ?? Number.POSITIVE_INFINITY
}

/** Minimal set shape this module needs (subset of CardSet). */
export interface PackMetaSet {
  id: string
  name: string
  type?: string | null
  cycle?: string | null
}

export interface PackLegalityGroup {
  /** Stable key (e.g. 'core', 'premium', 'cycle:Imperial Cycle', 'clan', 'other'). */
  key: string
  /** Header shown in the UI. */
  label: string
  /** Packs in this group, in release order. */
  packs: Array<{ id: string; name: string }>
}

// Top-level group sequence requested for the UI:
//   Core → Premium Expansions → each Cycle (own header) → Clan Packs → Other.
const GROUP_RANK: Record<string, number> = {
  core: 0,
  premium: 1,
  // cycles occupy rank 2 (ordered among themselves by earliest pack release)
  clan: 3,
  other: 4,
}

function groupKeyFor(set: PackMetaSet): { key: string; label: string; topRank: number } {
  switch (set.type) {
    case 'core':
      return { key: 'core', label: 'Core Set', topRank: GROUP_RANK.core }
    case 'premium':
      return { key: 'premium', label: 'Premium Expansions', topRank: GROUP_RANK.premium }
    case 'clan-pack':
      return { key: 'clan', label: 'Clan Packs', topRank: GROUP_RANK.clan }
    case 'dynasty-pack':
      if (set.cycle) {
        return { key: `cycle:${set.cycle}`, label: set.cycle, topRank: 2 }
      }
      return { key: 'other', label: 'Other', topRank: GROUP_RANK.other }
    default:
      return { key: 'other', label: 'Other', topRank: GROUP_RANK.other }
  }
}

/**
 * Group + order all packs for the pack-legality selector:
 *   Core, Premium Expansions, then each Cycle (with header) in release
 *   order, then Clan Packs, then anything else. Packs within a group are
 *   sorted by canonical release order; cycles are ordered among themselves
 *   by their earliest-released pack.
 */
export function buildPackLegalityGroups(sets: readonly PackMetaSet[]): PackLegalityGroup[] {
  const byKey = new Map<string, { label: string; topRank: number; packs: PackMetaSet[] }>()
  for (const set of sets) {
    const { key, label, topRank } = groupKeyFor(set)
    let g = byKey.get(key)
    if (!g) {
      g = { label, topRank, packs: [] }
      byKey.set(key, g)
    }
    g.packs.push(set)
  }

  const groups = Array.from(byKey.values()).map((g) => ({
    label: g.label,
    topRank: g.topRank,
    // earliest release among this group's packs — orders cycles among themselves
    minRank: Math.min(...g.packs.map((p) => releaseRank(p.id))),
    packs: g.packs
      .slice()
      .sort((a, b) => releaseRank(a.id) - releaseRank(b.id) || a.name.localeCompare(b.name))
      .map((p) => ({ id: p.id, name: p.name })),
  }))

  groups.sort((a, b) => a.topRank - b.topRank || a.minRank - b.minRank || a.label.localeCompare(b.label))

  return groups.map((g, i) => ({
    key: `${g.topRank}:${i}:${g.label}`,
    label: g.label,
    packs: g.packs,
  }))
}
