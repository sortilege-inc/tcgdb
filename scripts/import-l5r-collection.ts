/**
 * One-shot import: the existing L5R inventory tracker's JSON export
 *   (unsorted/l5r-inventory-*.json)
 * ->
 *   data/collection/l5r-lcg.json
 *
 * Uses the NEWEST inventory JSON in unsorted/ (sorted by filename, which
 * follows ISO-ish timestamp ordering).
 *
 * The legacy schema keys counts by `<setName>::<rawCardNum>`, where setName
 * may carry an instance suffix (e.g. "Core Set 1"). Per the existing notes,
 * Core Set ships pre-duplicated into three named instances. This importer
 * collapses instance suffixes into the base set and sums actuals/promos
 * across instances — Phase 2 tracks flat per-card counts, not per-instance.
 *
 * Run: npm run import:l5r-collection
 */
import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(__dirname, '..')
const UNSORTED_DIR = path.join(PROJECT_ROOT, 'unsorted')
const CARDS_DIR = path.join(PROJECT_ROOT, 'data', 'cards', 'l5r-lcg')
const SETS_DIR = path.join(PROJECT_ROOT, 'data', 'sets', 'l5r-lcg')
const OUT_PATH = path.join(PROJECT_ROOT, 'data', 'collection', 'l5r-lcg.json')

interface LegacyEntry {
  actual?: number
  promo?: number
  expected?: number
}
interface LegacyStateV2 {
  state?: {
    counts?: Record<string, LegacyEntry>
  }
  counts?: Record<string, LegacyEntry>
}

interface CollectionEntry {
  qty: number
  promoQty: number
  notes?: string
  unverified?: boolean
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildCardId(setId: string, rawNum: string): string {
  const m = /^(\d+)([A-Za-z]*)$/.exec(rawNum.trim())
  if (!m) return `${setId}-${slugify(rawNum)}`
  const num = m[1]!.padStart(3, '0')
  const suffix = (m[2] ?? '').toLowerCase()
  return `${setId}-${num}${suffix}`
}

/** "Core Set 1" -> "Core Set"; "Defenders of Rokugan" -> "Defenders of Rokugan". */
function stripInstanceSuffix(name: string): string {
  return name.replace(/ \d+$/, '')
}

function findLatestInventoryFile(): string | null {
  const entries = fs.readdirSync(UNSORTED_DIR)
    .filter((f) => /^l5r-inventory-.*\.json$/.test(f))
    .sort()
  return entries.length > 0 ? path.join(UNSORTED_DIR, entries[entries.length - 1]!) : null
}

function loadKnownCardIds(): Set<string> {
  const ids = new Set<string>()
  if (!fs.existsSync(CARDS_DIR)) return ids
  for (const file of fs.readdirSync(CARDS_DIR)) {
    if (!file.endsWith('.json')) continue
    const cards = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, file), 'utf-8')) as Array<{ id: string }>
    for (const c of cards) ids.add(c.id)
  }
  return ids
}

function loadKnownSetIds(): Set<string> {
  const ids = new Set<string>()
  if (!fs.existsSync(SETS_DIR)) return ids
  for (const file of fs.readdirSync(SETS_DIR)) {
    if (!file.endsWith('.json')) continue
    ids.add(file.replace(/\.json$/, ''))
  }
  return ids
}

function main(): void {
  const file = findLatestInventoryFile()
  if (!file) {
    console.error(`[import-l5r-collection] No inventory JSON found in ${UNSORTED_DIR}`)
    process.exit(1)
  }
  console.log(`[import-l5r-collection] Using ${path.basename(file)}`)

  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as LegacyStateV2
  const counts = raw.state?.counts ?? raw.counts ?? {}

  const knownCardIds = loadKnownCardIds()
  const knownSetIds = loadKnownSetIds()

  // Sum actuals/promos across collapsed instance suffixes per cardId.
  const acc = new Map<string, { qty: number; promoQty: number }>()
  let mappedRows = 0
  let unknownSetRows = 0
  let unknownCardRows = 0
  const unknownSets = new Set<string>()
  const unknownCards = new Set<string>()

  for (const [key, value] of Object.entries(counts)) {
    if (!key.includes('::')) continue
    const [rawSetName, rawCardNum] = key.split('::', 2) as [string, string]
    if (!rawSetName || !rawCardNum) continue

    const baseSetName = stripInstanceSuffix(rawSetName)
    const setId = slugify(baseSetName)
    if (!knownSetIds.has(setId)) {
      unknownSetRows++
      unknownSets.add(`${baseSetName} (slug=${setId})`)
      continue
    }
    const cardId = buildCardId(setId, rawCardNum)
    if (!knownCardIds.has(cardId)) {
      unknownCardRows++
      unknownCards.add(`${setId}::${rawCardNum} -> ${cardId}`)
      continue
    }

    const actual = typeof value.actual === 'number' ? value.actual : 0
    const promo = typeof value.promo === 'number' ? value.promo : 0
    if (actual <= 0 && promo <= 0) continue

    const prev = acc.get(cardId) ?? { qty: 0, promoQty: 0 }
    prev.qty += actual
    prev.promoQty += promo
    acc.set(cardId, prev)
    mappedRows++
  }

  // Build final output keyed by cardId. Drop zero-entries (defensive).
  // Every imported entry is stamped `unverified: true` — these counts came
  // from an external source and haven't been confirmed against the physical
  // cards. Manual edits via the UI clear this.
  const out: Record<string, CollectionEntry> = {}
  for (const [cardId, sums] of acc.entries()) {
    if (sums.qty === 0 && sums.promoQty === 0) continue
    out[cardId] = { qty: sums.qty, promoQty: sums.promoQty, unverified: true }
  }
  // Stable key order so diffs stay clean.
  const sorted: Record<string, CollectionEntry> = {}
  for (const k of Object.keys(out).sort()) sorted[k] = out[k]!

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf-8')

  console.log(`[import-l5r-collection] Wrote ${Object.keys(sorted).length} cards (sum across instances).`)
  console.log(`[import-l5r-collection]   mapped rows: ${mappedRows}`)
  if (unknownSetRows > 0) {
    console.warn(`[import-l5r-collection]   skipped ${unknownSetRows} rows for unknown sets:`)
    for (const s of unknownSets) console.warn(`    - ${s}`)
  }
  if (unknownCardRows > 0) {
    console.warn(`[import-l5r-collection]   skipped ${unknownCardRows} rows for unknown cards (sample):`)
    let n = 0
    for (const c of unknownCards) {
      console.warn(`    - ${c}`)
      if (++n >= 10) {
        console.warn(`    - ... (${unknownCards.size - n} more)`)
        break
      }
    }
  }
}

main()
