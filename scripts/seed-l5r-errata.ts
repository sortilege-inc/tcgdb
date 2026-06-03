/**
 * Seed a handful of sample errata + rulings on L5R cards so the Phase 5
 * model can be exercised end-to-end. These are intentionally marked as
 * placeholders — they're shaped like real errata, but the content is not
 * authoritative. Replace with real revisions when source material is
 * available.
 *
 * Idempotent: re-running overwrites the seeded entries in place.
 *
 * Run: npm run seed:l5r-errata
 */
import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(__dirname, '..')
const CARDS_DIR = path.join(PROJECT_ROOT, 'data', 'cards', 'l5r-lcg')

interface Card {
  id: string
  gameId: string
  setId: string
  publisherId: string
  name: string
  type: string
  text?: string
  errata?: Record<string, unknown>
  rulings?: Array<{ date: string; source: string; text: string }>
  [k: string]: unknown
}

interface ErrataSpec {
  cardId: string
  errata?: Record<string, unknown>
  rulings?: Array<{ date: string; source: string; text: string }>
}

const SAMPLE_SOURCE = '[sample — replace with authoritative source]'

// Hand-picked target cards. Each spec runs only if the cardId exists in
// the imported data (we don't fabricate cards).
const SPECS: ErrataSpec[] = [
  {
    cardId: 'core-set-002',
    rulings: [
      {
        date: '2026-06-03',
        source: SAMPLE_SOURCE,
        text: 'Sample ruling: Shizuka Toshi\'s ability triggers once per duel, not once per resolution step.',
      },
    ],
  },
  {
    cardId: 'core-set-004',
    errata: {
      text: '[Sample errata] Yōjin no Shiro: While you have at least one ready character with military skill 3 or higher, this stronghold gains "Reaction: After a unit declares an attack against this province — bow this card to bow the attacking character."',
    },
  },
  {
    cardId: 'core-set-008',
    rulings: [
      {
        date: '2026-06-03',
        source: SAMPLE_SOURCE,
        text: 'Sample ruling: Defend the Wall\'s effect resolves at the start of the conflict, before any character abilities.',
      },
    ],
  },
  {
    cardId: 'core-set-016',
    errata: {
      text: '[Sample errata] Elemental Fury: At the start of the conflict — give one participating character +1 military and +1 political for the duration of this conflict.',
    },
    rulings: [
      {
        date: '2026-06-03',
        source: SAMPLE_SOURCE,
        text: 'Sample ruling: Elemental Fury can target a character on either side; controller of Elemental Fury chooses.',
      },
    ],
  },
]

function readCardsFile(file: string): Card[] {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as Card[]
}

function writeCardsFile(file: string, cards: Card[]): void {
  fs.writeFileSync(file, JSON.stringify(cards, null, 2) + '\n', 'utf-8')
}

function main(): void {
  if (!fs.existsSync(CARDS_DIR)) {
    console.error(`[seed-l5r-errata] L5R card directory not found: ${CARDS_DIR}`)
    console.error('  Run "npm run import:l5r" first.')
    process.exit(1)
  }

  const targets = new Map<string, ErrataSpec>(SPECS.map((s) => [s.cardId, s]))
  let applied = 0
  let missing = 0
  const missingIds: string[] = []

  for (const fname of fs.readdirSync(CARDS_DIR)) {
    if (!fname.endsWith('.json')) continue
    const file = path.join(CARDS_DIR, fname)
    const cards = readCardsFile(file)
    let touched = false
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]!
      const spec = targets.get(c.id)
      if (!spec) continue
      const next: Card = { ...c }
      if (spec.errata) next.errata = spec.errata
      if (spec.rulings) next.rulings = spec.rulings
      cards[i] = next
      targets.delete(c.id)
      applied++
      touched = true
    }
    if (touched) writeCardsFile(file, cards)
  }

  for (const [id] of targets) {
    missing++
    missingIds.push(id)
  }

  console.log(`[seed-l5r-errata] Applied to ${applied} card${applied === 1 ? '' : 's'}.`)
  if (missing > 0) {
    console.warn(`[seed-l5r-errata] ${missing} target cardId(s) not found in data — skipped:`)
    for (const id of missingIds) console.warn(`  - ${id}`)
  }
}

main()
