/**
 * Migrate L5R card data for the deck-validation schema additions.
 *
 *   1. Province cards: `element: "air"` → `elements: ["air"]`.
 *      Dual-element provinces will need to be hand-set after; this script
 *      only promotes single-element values to the array form.
 *   2. Stronghold cards: rename `fate` → `fateIncome` (the printed value is
 *      fate-per-round income, not a cost; characters never had a fate field).
 *   3. Role cards: backfill roleClassifier / roleRing / roleClan /
 *      influenceBonus / forcesSplashClan by pattern-matching the name.
 *        - "Keeper of X" → keeper / X / +3
 *        - "Seeker of X" → seeker / X
 *        - "Support of X" → support / clan=X / +8 / forcesSplashClan=X
 *        - Other → roleClassifier="other"
 *
 * Usage:
 *   tsx scripts/migrate-deck-validation-schema.ts          # dry-run
 *   tsx scripts/migrate-deck-validation-schema.ts --apply  # writes
 */
import fs from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')
const PROJECT_ROOT = path.resolve(__dirname, '..')
const CARDS_DIR = path.join(PROJECT_ROOT, 'data', 'cards', 'l5r-lcg')

const RING_NAMES = new Set(['air', 'earth', 'fire', 'water', 'void'])
const CLAN_NAMES = new Set([
  'crab', 'crane', 'dragon', 'lion', 'phoenix', 'scorpion', 'unicorn',
])

interface MigrationReport {
  provincesPromoted: number
  strongholdsRenamed: number
  rolesClassified: Record<string, number>  // by classifier
  unmatchedRoles: string[]
}

interface CardLike {
  id: string
  type?: string
  name?: string
  element?: string
  elements?: string[]
  fate?: number
  fateIncome?: number
  roleClassifier?: string
  roleRing?: string
  roleClan?: string
  influenceBonus?: number
  forcesSplashClan?: string
  [k: string]: unknown
}

function classifyRole(name: string): {
  classifier: 'keeper' | 'seeker' | 'support' | 'other'
  ring?: string
  clan?: string
  influenceBonus?: number
  forcesSplashClan?: string
} {
  const trimmed = name.trim()
  // Optional "the" between "of" and the clan/ring word — supports both
  // "Support of Crane" and "Support of the Crane" phrasings.
  const m = /^(Keeper|Seeker|Support) of(?:\s+the)?\s+(\S.*)$/i.exec(trimmed)
  if (m) {
    const which = m[1]!.toLowerCase() as 'keeper' | 'seeker' | 'support'
    const token = m[2]!.trim().toLowerCase()
    if (which === 'keeper' && RING_NAMES.has(token)) {
      return { classifier: 'keeper', ring: token, influenceBonus: 3 }
    }
    if (which === 'seeker' && RING_NAMES.has(token)) {
      return { classifier: 'seeker', ring: token }
    }
    if (which === 'support' && CLAN_NAMES.has(token)) {
      // Capitalize the clan to match how it's stored elsewhere (Crane, not crane).
      const clan = token[0]!.toUpperCase() + token.slice(1)
      return {
        classifier: 'support',
        clan,
        influenceBonus: 8,
        forcesSplashClan: clan,
      }
    }
  }

  // Draft Pack alternates use "Allied with the [Clan]" instead of "Support of"
  // and have their own influence/effect text. Draft Pack isn't legal in
  // Standard/Stronghold (per user) so we don't need to classify exactly;
  // 'other' is fine.
  return { classifier: 'other' }
}

function migrateOne(card: CardLike, report: MigrationReport): {
  changed: boolean
  next: CardLike
} {
  const next: CardLike = { ...card }
  let changed = false

  // 1. element → elements (Province cards).
  if (card.type === 'Province' && typeof card.element === 'string' && !card.elements) {
    next.elements = [card.element]
    delete next.element
    report.provincesPromoted++
    changed = true
  }

  // 2. fate → fateIncome (Stronghold cards).
  if (card.type === 'Stronghold' && typeof card.fate === 'number' && card.fateIncome === undefined) {
    next.fateIncome = card.fate
    delete next.fate
    report.strongholdsRenamed++
    changed = true
  }

  // 3. Role classification.
  if (card.type === 'Role' && card.name && card.roleClassifier === undefined) {
    const c = classifyRole(card.name)
    next.roleClassifier = c.classifier
    if (c.ring) next.roleRing = c.ring
    if (c.clan) next.roleClan = c.clan
    if (c.influenceBonus !== undefined) next.influenceBonus = c.influenceBonus
    if (c.forcesSplashClan) next.forcesSplashClan = c.forcesSplashClan
    if (c.classifier === 'other') report.unmatchedRoles.push(`${card.id}  (${card.name})`)
    report.rolesClassified[c.classifier] = (report.rolesClassified[c.classifier] ?? 0) + 1
    changed = true
  }

  return { changed, next }
}

function main(): void {
  if (!fs.existsSync(CARDS_DIR)) {
    console.error(`cards dir not found: ${CARDS_DIR}`)
    process.exit(1)
  }
  const report: MigrationReport = {
    provincesPromoted: 0,
    strongholdsRenamed: 0,
    rolesClassified: {},
    unmatchedRoles: [],
  }
  const filesChanged: string[] = []

  for (const f of fs.readdirSync(CARDS_DIR)) {
    if (!f.endsWith('.json')) continue
    const full = path.join(CARDS_DIR, f)
    const cards = JSON.parse(fs.readFileSync(full, 'utf-8')) as CardLike[]
    let fileChanged = false
    const nextCards: CardLike[] = []
    for (const card of cards) {
      const { changed, next } = migrateOne(card, report)
      nextCards.push(next)
      if (changed) fileChanged = true
    }
    if (fileChanged) {
      filesChanged.push(f)
      if (APPLY) {
        fs.writeFileSync(full, JSON.stringify(nextCards, null, 2) + '\n', 'utf-8')
      }
    }
  }

  console.log(`[migrate] === report ===`)
  console.log(`  files touched:        ${filesChanged.length}`)
  console.log(`  provinces promoted:   ${report.provincesPromoted}`)
  console.log(`  strongholds renamed:  ${report.strongholdsRenamed}`)
  console.log(`  roles classified:`)
  for (const [k, n] of Object.entries(report.rolesClassified).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${k.padEnd(8)} ${n}`)
  }
  if (report.unmatchedRoles.length) {
    console.log(`  unmatched roles (classifier=other) — hand-tune if needed:`)
    for (const r of report.unmatchedRoles) console.log(`     ${r}`)
  }
  if (!APPLY) {
    console.log(`\n[migrate] DRY-RUN. Re-run with --apply to write.`)
  } else {
    console.log(`\n[migrate] wrote ${filesChanged.length} files.`)
  }
}

main()
