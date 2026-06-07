/**
 * Read .tmp/provinces-to-fill.csv (filled by the user) and patch each
 * Province card's `elements` field in data/cards/l5r-lcg/*.json.
 *
 *   CSV columns (no header expected; positional):
 *     0: cardId          (e.g. core-set-015)
 *     1: setId           (ignored — we route by cardId)
 *     2: name            (sanity check)
 *     3: elements        ("Fire", "Air;Water", etc. — case-insensitive; semicolon for dual)
 *     4: text_hint       (ignored)
 *
 *   Behavior:
 *     - Lowercases element tokens; validates each against the canonical
 *       set {air, earth, fire, water, void}.
 *     - Writes `elements: string[]` on the matched Province.
 *     - Removes any legacy `element: string` field if present.
 *     - Dry-run by default; --apply to write.
 *
 * Usage:
 *   tsx scripts/apply-province-elements.ts          # dry-run
 *   tsx scripts/apply-province-elements.ts --apply  # writes
 */
import fs from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')
const PROJECT_ROOT = path.resolve(__dirname, '..')
const CARDS_DIR   = path.join(PROJECT_ROOT, 'data', 'cards', 'l5r-lcg')
const CSV_PATH    = path.join(PROJECT_ROOT, '.tmp', 'provinces-to-fill.csv')

const VALID_RINGS = new Set(['air', 'earth', 'fire', 'water', 'void'])

interface CardLike {
  id: string
  type?: string
  name?: string
  element?: string
  elements?: string[]
  [k: string]: unknown
}

// Minimal CSV parser. Handles quoted fields with escaped quotes ("").
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let i = 0
  let cur = ''
  let inQuotes = false
  while (i < line.length) {
    const c = line[i]!
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 2; continue }
      if (c === '"') { inQuotes = false; i++; continue }
      cur += c; i++
    } else {
      if (c === ',') { out.push(cur); cur = ''; i++; continue }
      if (c === '"' && cur.length === 0) { inQuotes = true; i++; continue }
      cur += c; i++
    }
  }
  out.push(cur)
  return out
}

function main(): void {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`csv not found: ${CSV_PATH}`)
    process.exit(1)
  }
  const raw = fs.readFileSync(CSV_PATH, 'utf-8')
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)

  // Skip a header row if present.
  if (lines[0]?.toLowerCase().startsWith('cardid,')) lines.shift()

  interface PatchRow { cardId: string; name: string; elements: string[]; raw: string }
  const patches = new Map<string, PatchRow>()
  const invalidRows: Array<{ cardId: string; raw: string; reason: string }> = []

  for (const line of lines) {
    const cols = parseCsvLine(line)
    if (cols.length < 4) { invalidRows.push({ cardId: cols[0] ?? '?', raw: cols[3] ?? '', reason: 'too few columns' }); continue }
    const cardId = cols[0]!.trim()
    const name = cols[2]!.trim()
    const rawElements = (cols[3] ?? '').trim()
    if (!rawElements) { invalidRows.push({ cardId, raw: rawElements, reason: 'empty elements' }); continue }
    let tokens = rawElements.split(/[;,/|]/).map((t) => t.trim().toLowerCase()).filter(Boolean)
    // Special-case: "any" expands to all five rings (e.g. Toshi Ranbo,
    // which can occupy any element slot in a province set).
    if (tokens.length === 1 && tokens[0] === 'any') {
      tokens = ['air', 'earth', 'fire', 'water', 'void']
    }
    const bad = tokens.filter((t) => !VALID_RINGS.has(t))
    if (bad.length) { invalidRows.push({ cardId, raw: rawElements, reason: `unknown ring(s): ${bad.join(', ')}` }); continue }
    patches.set(cardId, { cardId, name, elements: tokens, raw: rawElements })
  }

  console.log(`[patch] read ${lines.length} rows; ${patches.size} valid, ${invalidRows.length} skipped`)
  for (const inv of invalidRows.slice(0, 10)) {
    console.log(`   skip ${inv.cardId}: ${inv.reason} (value=${JSON.stringify(inv.raw)})`)
  }
  if (invalidRows.length > 10) console.log(`   …and ${invalidRows.length - 10} more`)

  // Walk every card file, apply matching patches.
  let filesTouched = 0
  let provincesPatched = 0
  let provincesUnchanged = 0
  const matched = new Set<string>()

  for (const f of fs.readdirSync(CARDS_DIR)) {
    if (!f.endsWith('.json')) continue
    const full = path.join(CARDS_DIR, f)
    const cards = JSON.parse(fs.readFileSync(full, 'utf-8')) as CardLike[]
    let fileChanged = false
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]!
      if (c.type !== 'Province') continue
      const p = patches.get(c.id)
      if (!p) continue
      matched.add(c.id)
      const before = JSON.stringify(c.elements ?? null)
      const after = JSON.stringify(p.elements)
      if (before === after && c.element === undefined) {
        provincesUnchanged++
        continue
      }
      cards[i] = { ...c, elements: p.elements }
      if ('element' in cards[i]!) delete (cards[i] as Record<string, unknown>).element
      provincesPatched++
      fileChanged = true
    }
    if (fileChanged) {
      filesTouched++
      if (APPLY) fs.writeFileSync(full, JSON.stringify(cards, null, 2) + '\n', 'utf-8')
    }
  }

  const unmatched: string[] = []
  for (const cardId of patches.keys()) if (!matched.has(cardId)) unmatched.push(cardId)

  console.log(`\n[patch] === summary ===`)
  console.log(`  files touched:     ${filesTouched}`)
  console.log(`  provinces patched: ${provincesPatched}`)
  console.log(`  unchanged:         ${provincesUnchanged}`)
  console.log(`  unmatched cardIds: ${unmatched.length}`)
  for (const u of unmatched.slice(0, 10)) console.log(`     ${u}`)

  // Distribution: how many of each element ended up on the catalog.
  const dist = new Map<string, number>()
  for (const p of patches.values()) for (const r of p.elements) dist.set(r, (dist.get(r) ?? 0) + 1)
  console.log(`\n[patch] element distribution across patches:`)
  for (const [r, n] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${r.padEnd(6)} ${n}`)
  }
  const dualCount = [...patches.values()].filter((p) => p.elements.length > 1).length
  console.log(`   dual-element provinces: ${dualCount}`)

  if (!APPLY) console.log(`\n[patch] DRY-RUN. Re-run with --apply to write.`)
  else       console.log(`\n[patch] wrote ${filesTouched} files.`)
}

main()
