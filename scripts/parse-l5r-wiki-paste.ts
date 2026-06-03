/**
 * Parse an L5R Fandom wiki card-table HTML paste and apply the rows as
 * authoritative replacements to data/cards/l5r-lcg/<setSlug>.json under
 * the project's Replace policy.
 *
 *   Replace policy:
 *     - id, gameId, setId, publisherId stay (they're URL contracts).
 *     - All other fields come from the paste and only from the paste.
 *     - unverified is dropped on every replaced record (you've now
 *       confirmed the data against an authoritative-enough source).
 *
 *   Usage:
 *     npx tsx scripts/parse-l5r-wiki-paste.ts <html-path> <set-slug>            # dry-run
 *     npx tsx scripts/parse-l5r-wiki-paste.ts <html-path> <set-slug> --apply    # write
 *
 *   Per the project's "Surface and stop" policy: dry-run reports every
 *   unrecognised row, unmatched cardId, and other ambiguity. --apply
 *   refuses to run if any such issues are present.
 */
import fs from 'node:fs'
import path from 'node:path'

const HTML_PATH = process.argv[2]
const SET_SLUG = process.argv[3]
const APPLY = process.argv.includes('--apply')
const KEEP_UNVERIFIED = process.argv.includes('--keep-unverified')
const SHOW_ID = (() => {
  const i = process.argv.indexOf('--show-id')
  return i >= 0 ? process.argv[i + 1] : null
})()

if (!HTML_PATH || !SET_SLUG) {
  console.error('Usage: parse-l5r-wiki-paste.ts <html-path> <set-slug> [--apply]')
  process.exit(1)
}

const PROJECT_ROOT = path.resolve(__dirname, '..')
const CARDS_FILE = path.join(PROJECT_ROOT, 'data', 'cards', 'l5r-lcg', `${SET_SLUG}.json`)
if (!fs.existsSync(CARDS_FILE)) {
  console.error(`[parse] Card data not found for set "${SET_SLUG}": ${CARDS_FILE}`)
  process.exit(1)
}

interface CardRecord {
  id: string
  gameId: string
  setId: string
  publisherId: string
  name?: string
  type?: string
  unique?: boolean
  text?: string
  flavorText?: string
  illustrator?: string
  unverified?: boolean
  clan?: string
  deck?: string
  faction?: string
  side?: string
  cost?: number
  strength?: number
  influence?: number
  military?: number
  political?: number
  glory?: number
  honor?: number
  fate?: number
  influencePool?: number
  element?: string
  traits?: string[]
  errata?: Record<string, unknown>
  rulings?: Array<{ date: string; source: string; text: string }>
  [k: string]: unknown
}

interface ParsedRow {
  rawNum: string
  name: string
  unique: boolean
  clan: string | null
  deck: string | null
  type: string | null
  traits: string[]
  text: string
  // The raw HTML row, for debugging unrecognised rows.
  raw: string
}

interface Issue {
  rawNum?: string
  kind: 'unparseable-row' | 'unmatched-id' | 'unknown-clan' | 'unknown-type' | 'unknown-deck'
  detail: string
}

// ---------- HTML helpers ----------

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
}

function stripTagsToText(html: string, replaceBrWith: string): string {
  return decodeEntities(
    html
      .replace(/<img[^>]*alt="[mM]ilitary"[^>]*\/?>/g, '[mil]')
      .replace(/<img[^>]*alt="[pP]olitical"[^>]*\/?>/g, '[pol]')
      .replace(/<img[^>]*alt="[vV]oid"[^>]*\/?>/g, '[void]')
      .replace(/<img[^>]*alt="[fF]ire"[^>]*\/?>/g, '[fire]')
      .replace(/<img[^>]*alt="[wW]ater"[^>]*\/?>/g, '[water]')
      .replace(/<img[^>]*alt="[aA]ir"[^>]*\/?>/g, '[air]')
      .replace(/<img[^>]*alt="[eE]arth"[^>]*\/?>/g, '[earth]')
      .replace(/<img[^>]*alt="[uU]nique"[^>]*\/?>/g, '')
      // Bullet markers used inside multi-line card text on multiplayer
      // expansions (Negotiation Table, Hallowed Ground, A Game of Letters).
      .replace(/<img[^>]*alt="dot"[^>]*\/?>/g, '•')
      .replace(/<img[^>]*\/?>/g, '')
      .replace(/<br\s*\/?>/gi, replaceBrWith)
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const CLAN_BY_ALT: Record<string, string> = {
  crab: 'Crab', crane: 'Crane', dragon: 'Dragon', lion: 'Lion',
  phoenix: 'Phoenix', scorpion: 'Scorpion', unicorn: 'Unicorn',
  neutral: 'Neutral',
}

function extractClan(cellHtml: string): string | null {
  const m = /<img[^>]*alt="([a-z]+)"/i.exec(cellHtml)
  if (!m) return null
  return CLAN_BY_ALT[m[1]!.toLowerCase()] ?? null
}

function isUnique(cellHtml: string): boolean {
  return /<img[^>]*alt="Unique"/.test(cellHtml)
}

function extractAnchorText(cellHtml: string): string | null {
  // Get the displayed text of the first <a>...</a>
  const m = /<a[^>]*>([^<]*)<\/a>/i.exec(cellHtml)
  return m ? decodeEntities(m[1]!).trim() : null
}

function extractName(cellHtml: string): string {
  const a = extractAnchorText(cellHtml)
  if (a) return a
  // Fall back to text content with no <br> handling.
  return stripTagsToText(cellHtml, ' ')
}

function extractTraits(cellHtml: string): string[] {
  if (/^\s*—\s*$/.test(cellHtml)) return []
  const matches = cellHtml.match(/<a[^>]*>([^<]+)<\/a>/g) || []
  return matches
    .map((a) => {
      const m = /<a[^>]*>([^<]+)<\/a>/.exec(a)
      return m ? decodeEntities(m[1]!).trim() : ''
    })
    .filter(Boolean)
}

function extractDeck(cellHtml: string): string | null {
  const raw = stripTagsToText(cellHtml, ' ').toLowerCase()
  if (raw === '' || raw === '—') return null
  if (raw.startsWith('dynasty')) return 'dynasty'
  if (raw.startsWith('conflict')) return 'conflict'
  return null
}

function extractType(cellHtml: string): string | null {
  const txt = stripTagsToText(cellHtml, ' ').trim()
  if (!txt || txt === '—') return null
  // Type cell normally contains a single typed link (Character/Event/etc.)
  // The text is the type itself.
  return txt
}

// ---------- Row parsing ----------

function splitRows(html: string): string[] {
  const out: string[] = []
  const re = /<tr>([\s\S]*?)<\/tr>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) out.push(m[1]!)
  return out
}

function splitCells(rowHtml: string): string[] {
  const out: string[] = []
  const re = /<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(rowHtml)) !== null) out.push(m[1]!)
  return out
}

function parseRow(rowHtml: string, issues: Issue[]): ParsedRow | null {
  const cells = splitCells(rowHtml)
  if (cells.length === 0) return null // header row
  if (cells.length !== 7) {
    issues.push({
      kind: 'unparseable-row',
      detail: `Expected 7 cells, got ${cells.length}.`,
    })
    return null
  }
  const rawNum = cells[0]!.trim()
  if (!/^\d+[A-Za-z]?$/.test(rawNum)) {
    issues.push({
      kind: 'unparseable-row',
      detail: `ID cell does not look like a number: "${rawNum}"`,
    })
    return null
  }
  const clan = extractClan(cells[2]!)
  if (!clan) {
    issues.push({
      rawNum,
      kind: 'unknown-clan',
      detail: `Could not extract clan from cell: "${cells[2]!.trim().slice(0, 80)}"`,
    })
  }
  const deck = extractDeck(cells[3]!)
  if (deck === null && !/^\s*—\s*$/.test(cells[3]!)) {
    issues.push({ rawNum, kind: 'unknown-deck', detail: `Deck cell: "${cells[3]!.trim()}"` })
  }
  const type = extractType(cells[4]!)
  if (!type) {
    issues.push({ rawNum, kind: 'unknown-type', detail: `Type cell empty.` })
  }
  return {
    rawNum,
    name: extractName(cells[1]!),
    unique: isUnique(cells[1]!),
    clan,
    deck,
    type,
    traits: extractTraits(cells[5]!),
    text: stripTagsToText(cells[6]!, '\n'),
    raw: rowHtml,
  }
}

// ---------- ID resolution ----------

function buildCardId(setSlug: string, rawNum: string): string {
  const m = /^(\d+)([A-Za-z]*)$/.exec(rawNum)
  if (!m) return `${setSlug}-${rawNum.toLowerCase()}`
  const num = m[1]!.padStart(3, '0')
  const suffix = (m[2] ?? '').toLowerCase()
  return `${setSlug}-${num}${suffix}`
}

// ---------- Main ----------

function main(): void {
  const html = fs.readFileSync(HTML_PATH, 'utf-8')
  const existing = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8')) as CardRecord[]
  const byId = new Map(existing.map((c) => [c.id, c] as const))

  const issues: Issue[] = []
  const rows = splitRows(html).slice(0) // skip header is handled by 7-cell check
  const parsed: ParsedRow[] = []
  for (const r of rows) {
    const row = parseRow(r, issues)
    if (row) parsed.push(row)
  }

  // Match parsed rows to existing records.
  const replacements: { id: string; before: CardRecord; after: CardRecord; row: ParsedRow }[] = []
  const seenIds = new Set<string>()
  for (const row of parsed) {
    const id = buildCardId(SET_SLUG, row.rawNum)
    const before = byId.get(id)
    if (!before) {
      issues.push({
        rawNum: row.rawNum,
        kind: 'unmatched-id',
        detail: `No existing card with id "${id}" for "${row.name}".`,
      })
      continue
    }
    if (seenIds.has(id)) {
      issues.push({
        rawNum: row.rawNum,
        kind: 'unmatched-id',
        detail: `Duplicate row for id "${id}" — "${row.name}".`,
      })
      continue
    }
    seenIds.add(id)

    const after: CardRecord = {
      id: before.id,
      gameId: before.gameId,
      setId: before.setId,
      publisherId: before.publisherId,
      name: row.name,
      ...(row.type ? { type: row.type } : {}),
      ...(row.unique ? { unique: true } : {}),
      ...(row.clan ? { clan: row.clan } : {}),
      ...(row.deck ? { deck: row.deck } : {}),
      ...(row.traits.length > 0 ? { traits: row.traits } : {}),
      ...(row.text ? { text: row.text } : {}),
      // unverified is normally dropped by Replace policy, but can be kept
      // when the caller knows the paste still needs follow-up.
      ...(KEEP_UNVERIFIED ? { unverified: true } : {}),
      // errata/rulings preserved if previously set; this paste doesn't carry them.
      ...(before.errata ? { errata: before.errata } : {}),
      ...(before.rulings ? { rulings: before.rulings } : {}),
    }
    replacements.push({ id, before, after, row })
  }

  // Report
  const totalExisting = existing.length
  const matched = replacements.length
  const unmatched = totalExisting - matched
  console.log(`[parse] set: ${SET_SLUG}`)
  console.log(`[parse] paste rows parsed: ${parsed.length}`)
  console.log(`[parse] matched to existing records: ${matched} / ${totalExisting}`)
  if (unmatched > 0) {
    const matchedIds = new Set(replacements.map((r) => r.id))
    const missingFromPaste = existing.filter((c) => !matchedIds.has(c.id)).map((c) => c.id)
    console.log(`[parse] existing records NOT in paste (${unmatched}):`)
    for (const id of missingFromPaste.slice(0, 20)) console.log(`    - ${id}`)
    if (missingFromPaste.length > 20) console.log(`    - ...${missingFromPaste.length - 20} more`)
  }

  if (issues.length > 0) {
    console.log(`\n[parse] ISSUES (${issues.length}):`)
    for (const i of issues) {
      console.log(`  - [${i.kind}]${i.rawNum ? ` (raw#${i.rawNum})` : ''}: ${i.detail}`)
    }
  } else {
    console.log(`[parse] no issues.`)
  }

  // Sample replacements (or a specific one via --show-id)
  if (SHOW_ID) {
    const hit = replacements.find((r) => r.row.rawNum === SHOW_ID || r.id.endsWith(`-${SHOW_ID}`) || r.id.endsWith(`-${SHOW_ID.padStart(3, '0')}`))
    if (hit) {
      console.log(`\n[parse] --show-id "${SHOW_ID}" matched ${hit.id}:`)
      console.log(JSON.stringify(hit.after, null, 2).split('\n').map((l) => '  ' + l).join('\n'))
    } else {
      console.log(`\n[parse] --show-id "${SHOW_ID}" did not match any replacement.`)
    }
  } else {
    const samples = replacements.slice(0, 3)
    if (samples.length > 0) {
      console.log(`\n[parse] sample replacements (first ${samples.length}):`)
      for (const s of samples) {
        console.log(`  --- ${s.id} ---`)
        console.log(JSON.stringify(s.after, null, 2).split('\n').map((l) => '  ' + l).join('\n'))
      }
    }
  }

  if (!APPLY) {
    console.log(`\n[parse] DRY-RUN. Re-run with --apply to write.`)
    return
  }

  if (issues.length > 0) {
    console.error(`\n[parse] Refusing to --apply while ${issues.length} issue(s) outstanding.`)
    process.exit(1)
  }

  // Build the final card array: keep records not in the paste unchanged,
  // replace the matched ones, sort by id.
  const matchedById = new Map(replacements.map((r) => [r.id, r.after] as const))
  const next = existing
    .map((c) => matchedById.get(c.id) ?? c)
    .sort((a, b) => a.id.localeCompare(b.id))

  fs.writeFileSync(CARDS_FILE, JSON.stringify(next, null, 2) + '\n', 'utf-8')
  console.log(`\n[parse] Wrote ${next.length} records to ${path.relative(PROJECT_ROOT, CARDS_FILE)}`)
  console.log(`[parse]   ${matched} replaced, ${next.length - matched} unchanged.`)
}

main()
