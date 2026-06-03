/**
 * One-shot import: unsorted/l5r_cards.csv -> data/sets/l5r-lcg/*.json
 *                                          -> data/cards/l5r-lcg/*.json
 *
 * Run: npm run import:l5r
 *      (or: npx tsx scripts/import-l5r.ts)
 *
 * The CSV ships with the existing reference material in unsorted/. Each row:
 *   Set Category, Set Name, Card ID, Card Name, Clan, Deck, Card Type
 *
 * Output is intentionally minimal — text / cost / glory / honor etc. are
 * not in the CSV. Phase 1 only needs enough structure to browse + filter.
 * Richer per-card data lands in a later import.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Card, CardSet } from '../src/types/data'

const PROJECT_ROOT = path.resolve(__dirname, '..')
const CSV_PATH = path.join(PROJECT_ROOT, 'unsorted', 'l5r_cards.csv')
const SETS_OUT_DIR = path.join(PROJECT_ROOT, 'data', 'sets', 'l5r-lcg')
const CARDS_OUT_DIR = path.join(PROJECT_ROOT, 'data', 'cards', 'l5r-lcg')

const GAME_ID = 'l5r-lcg'
const PUBLISHER_ID = 'ffg'

/**
 * Cards present in the CSV that are physically the flip side of another
 * card. We track the "front" side only. Keyed by (Set Name, Card ID).
 *
 * Pulled from the existing build_app.py.
 */
const EXCLUDED: Array<[string, string]> = [
  ['Core Set', '214B'],
  ['Core Set', '215B'],
  ['Core Set', '216B'],
  ['Core Set', '217B'],
  ['Core Set', '218B'],
  ["Under Fu Leng's Shadow", '1A'],
  ["Under Fu Leng's Shadow", '2A'],
  ["Under Fu Leng's Shadow", '3A'],
]
const excludedKeys = new Set(EXCLUDED.map(([s, n]) => `${s}::${n}`))

/** Category -> (set type, cycle name?) */
const CATEGORY_MAP: Record<string, { type: string; cycle?: string }> = {
  'Core Set':          { type: 'core' },
  'Clan Pack':         { type: 'clan-pack' },
  'Imperial Cycle':    { type: 'dynasty-pack', cycle: 'Imperial Cycle' },
  'Elemental Cycle':   { type: 'dynasty-pack', cycle: 'Elemental Cycle' },
  'Inheritance Cycle': { type: 'dynasty-pack', cycle: 'Inheritance Cycle' },
  'Dominion Cycle':    { type: 'dynasty-pack', cycle: 'Dominion Cycle' },
  'Temptations Cycle': { type: 'dynasty-pack', cycle: 'Temptations Cycle' },
  'Premium Expansion': { type: 'premium' },
}

/** Slugify for stable IDs. Locked: changing this breaks URLs. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/['’`]/g, '')                            // drop apostrophes
    .replace(/[^a-z0-9]+/g, '-')                      // non-alphanumeric -> hyphen
    .replace(/^-+|-+$/g, '')                          // trim hyphens
}

/** Card-ID convention: `<setId>-<num zero-padded><lower-case suffix>`. */
function buildCardId(setId: string, rawNum: string): string {
  const m = /^(\d+)([A-Za-z]*)$/.exec(rawNum.trim())
  if (!m) return `${setId}-${slugify(rawNum)}`
  const num = m[1]!.padStart(3, '0')
  const suffix = (m[2] ?? '').toLowerCase()
  return `${setId}-${num}${suffix}`
}

function normaliseDash(s: string): string {
  const trimmed = s.trim()
  return trimmed === '—' || trimmed === '-' || trimmed === '–' ? '' : trimmed
}

/** Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas, BOM. */
function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        row.push(field)
        field = ''
      } else if (c === '\r') {
        // ignore; \n will close the row
      } else if (c === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      } else {
        field += c
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.length > 0))
}

interface CsvRow {
  category: string
  setName: string
  rawCardNum: string
  cardName: string
  clan: string
  deck: string
  type: string
}

function rowToRecord(headers: string[], row: string[]): CsvRow {
  const get = (label: string): string => {
    const i = headers.indexOf(label)
    return i >= 0 ? (row[i] ?? '') : ''
  }
  return {
    category:   get('Set Category').trim(),
    setName:    get('Set Name').trim(),
    rawCardNum: get('Card ID').trim(),
    cardName:   get('Card Name').trim(),
    clan:       normaliseDash(get('Clan')),
    deck:       normaliseDash(get('Deck')),
    type:       get('Card Type').trim(),
  }
}

function main(): void {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`[import-l5r] CSV not found at ${CSV_PATH}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf-8')
  const parsed = parseCsv(raw)
  if (parsed.length === 0) {
    console.error('[import-l5r] CSV is empty.')
    process.exit(1)
  }
  const [headers, ...dataRows] = parsed as [string[], ...string[][]]
  const rows = dataRows.map((r) => rowToRecord(headers, r))

  // Group by set.
  interface SetGroup {
    setName: string
    category: string
    rows: CsvRow[]
  }
  const groups = new Map<string, SetGroup>()
  for (const r of rows) {
    if (!r.setName || !r.rawCardNum) continue
    if (excludedKeys.has(`${r.setName}::${r.rawCardNum}`)) continue
    const key = r.setName
    let group = groups.get(key)
    if (!group) {
      group = { setName: r.setName, category: r.category, rows: [] }
      groups.set(key, group)
    }
    group.rows.push(r)
  }

  fs.mkdirSync(SETS_OUT_DIR, { recursive: true })
  fs.mkdirSync(CARDS_OUT_DIR, { recursive: true })

  // Clear existing outputs so removed rows don't linger.
  for (const dir of [SETS_OUT_DIR, CARDS_OUT_DIR]) {
    for (const entry of fs.readdirSync(dir)) {
      if (entry.endsWith('.json')) fs.unlinkSync(path.join(dir, entry))
    }
  }

  let totalCards = 0
  let totalSets = 0
  for (const group of groups.values()) {
    const setId = slugify(group.setName)
    const cat = CATEGORY_MAP[group.category]
    if (!cat) {
      console.warn(`[import-l5r] unknown category "${group.category}" for set "${group.setName}" — skipping`)
      continue
    }

    const cards: Card[] = group.rows.map<Card>((r) => {
      const cardId = buildCardId(setId, r.rawCardNum)
      const card: Card = {
        id: cardId,
        gameId: GAME_ID,
        setId,
        publisherId: PUBLISHER_ID,
        name: r.cardName,
        type: r.type,
      }
      if (r.clan && r.clan !== '') (card as Card & { clan?: string }).clan = r.clan
      if (r.deck && r.deck !== '') (card as Card & { deck?: string }).deck = r.deck.toLowerCase()
      return card
    })

    const set: CardSet = {
      id: setId,
      gameId: GAME_ID,
      publisherId: PUBLISHER_ID,
      name: group.setName,
      type: cat.type,
      status: 'released',
      cardCount: cards.length,
    }
    if (cat.cycle) set.cycle = cat.cycle

    fs.writeFileSync(
      path.join(SETS_OUT_DIR, `${setId}.json`),
      JSON.stringify(set, null, 2) + '\n',
      'utf-8'
    )
    fs.writeFileSync(
      path.join(CARDS_OUT_DIR, `${setId}.json`),
      JSON.stringify(cards, null, 2) + '\n',
      'utf-8'
    )

    totalSets++
    totalCards += cards.length
  }

  console.log(`[import-l5r] Wrote ${totalSets} sets, ${totalCards} cards.`)
}

main()
