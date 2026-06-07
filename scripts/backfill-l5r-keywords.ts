/**
 * Parse L5R card text for printed keywords and write them back as a
 * structured `keywords: string[]` field on each card.
 *
 * Per CLAUDE.md (long-running scripts): smoke-tests one parse before the
 * loop, streams progress every 100 cards, catches per-card errors with
 * up to 3 samples, surfaces totals at the end. The default is dry-run
 * (preview only); pass `--apply` to write back.
 *
 * Canonical L5R keyword vocabulary (RRG entries):
 *   covert     — RRG p. 6 ("Covert"). When this character attacks, choose one character without covert. That character cannot be declared as a defender.
 *   courtesy   — RRG p. 6 ("Courtesy"). When this card leaves play, its controller gains 1 fate.
 *   pride      — RRG p. 17 ("Pride"). After this character wins a conflict, honor it. After this character loses a conflict, dishonor it.
 *   sincerity  — RRG p. 20 ("Sincerity"). When this character leaves play, draw 1 card.
 *   rally      — RRG p. 18 ("Rally"). After this card is revealed in a province, add the top card of your dynasty deck to the province, faceup.
 *   eminent    — RRG p. 9 ("Eminent"). Eminent provinces start the game face-up.
 *   disguise   — RRG p. 7 ("Disguise"). Play as an attachment that replaces a non-unique character.
 *   restricted — RRG p. 18 ("Restricted"). A deck may contain at most 2 cards with the restricted keyword.
 *
 * Matching rule: a keyword is recognized only when it appears at the
 * start of a paragraph (line) followed by '.' or ':'. This rejects
 * references-in-prose like Hida Etsuji's "cannot be evaded by the
 * covert keyword".
 *
 * Usage:
 *   tsx scripts/backfill-l5r-keywords.ts            # dry-run preview
 *   tsx scripts/backfill-l5r-keywords.ts --apply    # write to JSON
 *   tsx scripts/backfill-l5r-keywords.ts --apply --quiet
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Card } from '../src/types/data'

const ROOT = path.resolve(__dirname, '..')
const CARDS_DIR = path.join(ROOT, 'data', 'cards', 'l5r-lcg')

const CANONICAL_KEYWORDS = [
  'covert',
  'courtesy',
  'pride',
  'sincerity',
  'rally',
  'eminent',
  'disguise',
  'restricted',
] as const
type Keyword = typeof CANONICAL_KEYWORDS[number]

const KEYWORD_TITLES: Record<Keyword, string> = {
  covert: 'Covert',
  courtesy: 'Courtesy',
  pride: 'Pride',
  sincerity: 'Sincerity',
  rally: 'Rally',
  eminent: 'Eminent',
  disguise: 'Disguise',
  restricted: 'Restricted',
}

// One regex per keyword. Match at start of a line (allow optional <b>
// wrapper), keyword name, then '.' or ':'. Case-insensitive. The `m`
// flag makes ^ match line-starts inside the text blob.
const KEYWORD_REGEX: Record<Keyword, RegExp> = Object.fromEntries(
  CANONICAL_KEYWORDS.map((kw) => [
    kw,
    new RegExp(`^\\s*(?:<b>)?${KEYWORD_TITLES[kw]}(?:</b>)?[\\.\\:]`, 'mi'),
  ])
) as Record<Keyword, RegExp>

interface ParseResult {
  keywords: Keyword[]
}

function parseKeywords(text: string): ParseResult {
  const found: Keyword[] = []
  for (const kw of CANONICAL_KEYWORDS) {
    if (KEYWORD_REGEX[kw].test(text)) {
      found.push(kw)
    }
  }
  return { keywords: found }
}

interface Change {
  cardId: string
  cardName: string
  type: string
  before: string[] | undefined
  after: Keyword[]
}

function changeKind(c: Change): 'new' | 'added' | 'unchanged' | 'removed' | 'reordered' {
  if (c.before === undefined && c.after.length === 0) return 'unchanged'  // both effectively-empty
  if (c.before === undefined) return 'new'                                  // first time setting
  // From here, c.before is defined as an array
  const beforeSet = new Set(c.before)
  const afterSet = new Set(c.after)
  if (beforeSet.size !== afterSet.size) {
    return beforeSet.size < afterSet.size ? 'added' : 'removed'
  }
  for (const k of beforeSet) if (!afterSet.has(k)) return 'removed'
  if (c.before.join(',') !== c.after.join(',')) return 'reordered'
  return 'unchanged'
}

function loadCards(): Array<{ file: string; cards: Card[] }> {
  const out: Array<{ file: string; cards: Card[] }> = []
  for (const f of fs.readdirSync(CARDS_DIR)) {
    if (!f.endsWith('.json')) continue
    const cards = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, f), 'utf-8')) as Card[]
    out.push({ file: f, cards })
  }
  return out
}

function main(): void {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const quiet = args.includes('--quiet')
  const log = (msg: string): void => {
    if (!quiet) { process.stdout.write(msg + '\n') }
  }

  log(`[keywords] mode: ${apply ? 'APPLY (will write JSON)' : 'DRY-RUN (preview only — use --apply to write)'}`)

  // Smoke-test one parse before the loop.
  const smokeText = 'Rally. <i>(After this card is revealed in a province, add the top card of your dynasty deck to the province, faceup.)</i>\n<b>Interrupt:</b> When the conflict phase ends, if you control 1 or fewer broken provinces - gain 1 honor.'
  const smoke = parseKeywords(smokeText)
  if (smoke.keywords.length !== 1 || smoke.keywords[0] !== 'rally') {
    console.error(`[keywords] SMOKE FAIL: expected [rally], got ${JSON.stringify(smoke.keywords)}`)
    process.exit(1)
  }
  log('[keywords] smoke ok (Pious Guardian text → [rally])')

  // Anti-smoke: text that references a keyword in prose should NOT match.
  const antiText = 'This character cannot be evaded by the covert keyword.'
  const antiSmoke = parseKeywords(antiText)
  if (antiSmoke.keywords.length !== 0) {
    console.error(`[keywords] ANTI-SMOKE FAIL: expected [], got ${JSON.stringify(antiSmoke.keywords)}`)
    process.exit(1)
  }
  log('[keywords] anti-smoke ok (Hida Etsuji prose → [])')

  // Load all card files.
  const packs = loadCards()
  const totalCards = packs.reduce((n, p) => n + p.cards.length, 0)
  log(`[keywords] loaded ${packs.length} packs, ${totalCards} cards`)

  const changes: Change[] = []
  let processed = 0
  let errors = 0
  const errorSamples: string[] = []

  const t0 = Date.now()
  for (const { cards } of packs) {
    for (const card of cards) {
      processed++
      try {
        const text = (card.text as string | undefined) ?? ''
        const { keywords: newKeywords } = parseKeywords(text)
        const before = card.keywords as string[] | undefined
        // Record any change (and "unchanged" for visibility in stats).
        changes.push({
          cardId: card.id,
          cardName: card.name,
          type: card.type,
          before,
          after: newKeywords,
        })
      } catch (e: unknown) {
        errors++
        if (errorSamples.length < 3) errorSamples.push(`${card.id}: ${(e as Error).message}`)
      }
      if (processed % 200 === 0 || processed === totalCards) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
        log(`  [${processed}/${totalCards}] elapsed=${elapsed}s errors=${errors}`)
      }
    }
  }

  for (const s of errorSamples) log(`  err: ${s}`)

  // Tally + present.
  const byKind: Record<string, Change[]> = { new: [], added: [], removed: [], reordered: [], unchanged: [] }
  for (const c of changes) byKind[changeKind(c)]!.push(c)

  const keywordCounts: Record<string, number> = {}
  for (const c of changes) {
    for (const kw of c.after) keywordCounts[kw] = (keywordCounts[kw] ?? 0) + 1
  }

  log('')
  log('[keywords] === summary ===')
  log(`  new (first-time set):      ${byKind.new!.length}`)
  log(`  added (more than before):  ${byKind.added!.length}`)
  log(`  removed (fewer than before): ${byKind.removed!.length}`)
  log(`  reordered:                 ${byKind.reordered!.length}`)
  log(`  unchanged:                 ${byKind.unchanged!.length}`)
  log('')
  log('[keywords] keyword distribution across catalog:')
  for (const kw of CANONICAL_KEYWORDS) {
    log(`  ${kw.padEnd(12)} ${keywordCounts[kw] ?? 0}`)
  }

  // Show first 10 of each non-unchanged kind for visual sanity check.
  for (const kind of ['new', 'added', 'removed', 'reordered'] as const) {
    const list = byKind[kind]!
    if (list.length === 0) continue
    log('')
    log(`[keywords] sample of "${kind}" (first ${Math.min(10, list.length)} of ${list.length}):`)
    for (const c of list.slice(0, 10)) {
      log(`  ${c.cardId.padEnd(42)} ${c.type.padEnd(11)} ${c.cardName.padEnd(28)} ${JSON.stringify(c.before ?? null)} → ${JSON.stringify(c.after)}`)
    }
  }

  if (!apply) {
    log('')
    log('[keywords] dry-run — no writes. Re-run with --apply to commit changes.')
    return
  }

  // Apply: write each pack file back with the new keywords field.
  log('')
  log('[keywords] writing back to JSON…')
  const writeChangeIds = new Set(
    changes
      .filter((c) => changeKind(c) !== 'unchanged')
      .map((c) => c.cardId)
  )
  let written = 0
  for (const { file, cards } of packs) {
    let modified = false
    for (const card of cards) {
      if (!writeChangeIds.has(card.id)) continue
      const change = changes.find((c) => c.cardId === card.id)!
      if (change.after.length === 0) {
        // Don't write empty arrays — drop the field entirely so the
        // export envelope stays small. (Compare via changeKind() result.)
        delete (card as Record<string, unknown>).keywords
      } else {
        ;(card as Record<string, unknown>).keywords = change.after
      }
      modified = true
      written++
    }
    if (modified) {
      const out = path.join(CARDS_DIR, file)
      fs.writeFileSync(out, JSON.stringify(cards, null, 2) + '\n', 'utf-8')
    }
  }
  log(`[keywords] wrote ${written} card records across ${packs.length} files`)
}

main()
