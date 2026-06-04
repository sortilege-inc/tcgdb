/**
 * Merge the EmeraldDB Core Set scrape sitting in ../../core/ into our
 * data/cards/l5r-lcg/core-set.json.
 *
 *   Mapping:
 *     - scrape.faction      → record.clan
 *     - scrape.deck         → record.deck         (lowercased)
 *     - scrape military/political on a Character    → record.military/political (str, e.g. "3", "—")
 *     - scrape military/political on an Attachment  → record.militaryBonus/politicalBonus (str, e.g. "+1")
 *     - scrape cost/glory/strength/honor/fate/
 *              influencePool/influenceCost          → record.* (int) — scraped influenceCost → record.influence
 *     - scrape text/flavorText/traits/illustrator/
 *              unique/type                          → record.* (verbatim)
 *     - scrape rulings[]                            → record.rulings[] (replace)
 *     - scrape.image.savedAs (file in core/)        → moved to static/cards/l5r-lcg/<cardId>.<ext>
 *                                                     and recorded as record.imagePath
 *
 *   Preserved from existing record:
 *     id, gameId, setId, publisherId, flipSideOf, errata
 *
 *   Dropped: unverified
 *   Skipped: scrape slug "test-above-question" (a stray scrape test entry)
 *
 *   Match strategy:
 *     primary  — scrape.collectorNumber → core-set-NNN
 *     fallback — case-insensitive name match (resolves Keeper/Seeker pairs
 *                that share a collector number but have distinct names)
 *
 *   Usage:
 *     tsx scripts/merge-emerald-core.ts            # dry-run summary
 *     tsx scripts/merge-emerald-core.ts --apply    # writes data + moves images
 */
import fs from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const SCRAPE_DIR   = path.resolve(__dirname, '..', '..', 'core')
const CARDS_FILE   = path.join(PROJECT_ROOT, 'data', 'cards', 'l5r-lcg', 'core-set.json')
const IMG_DEST_DIR = path.join(PROJECT_ROOT, 'static', 'cards', 'l5r-lcg')
const IMG_URL_PREFIX = '/cards/l5r-lcg'

// =============================================================================
// Types
// =============================================================================

interface ScrapeRuling {
  source?: string | null
  sourceUrl?: string | null
  text?: string | null
}

interface ScrapeImage {
  sourceUrl?: string | null
  savedAs?: string | null
}

interface ScrapeRecord {
  slug?: string
  name?: string
  faction?: string | null
  type?: string | null
  unique?: boolean | null
  traits?: string[] | null
  cost?: number | null
  military?: string | null
  political?: string | null
  glory?: number | null
  strength?: number | null
  honor?: number | null
  fate?: number | null
  influencePool?: number | null
  influenceCost?: number | null
  deck?: string | null
  text?: string | null
  flavorText?: string | null
  set?: string | null
  collectorNumber?: number | null
  illustrator?: string | null
  image?: ScrapeImage | null
  rulings?: ScrapeRuling[] | null
}

interface CardRecord {
  id: string
  gameId: string
  setId: string
  publisherId: string
  name?: string
  /** ASCII alternate of name (e.g. emeralddb's "Wandering Ronin" alongside our "Wandering Rōnin"). */
  nameAscii?: string
  type?: string
  unique?: boolean
  text?: string
  flavorText?: string
  illustrator?: string
  imagePath?: string
  clan?: string
  deck?: string
  traits?: string[]
  /** ASCII alternate of traits (e.g. ["Bushi","Yojimbo"] alongside our ["Bushi","Yōjimbō"]). */
  traitsAscii?: string[]
  cost?: number
  military?: string
  political?: string
  militaryBonus?: string
  politicalBonus?: string
  glory?: number
  strength?: number
  honor?: number
  fate?: number
  influencePool?: number
  influence?: number
  errata?: Record<string, unknown>
  rulings?: Array<{ date?: string; source?: string; sourceUrl?: string; text?: string }>
  flipSideOf?: string
  unverified?: boolean
  [k: string]: unknown
}

// =============================================================================
// Pick scrape winners (highest numeric suffix per slug)
// =============================================================================

interface Winner { slug: string; file: string; data: ScrapeRecord }

function listScrapeWinners(): Winner[] {
  const buckets = new Map<string, Array<{ n: number; file: string }>>()
  for (const f of fs.readdirSync(SCRAPE_DIR)) {
    if (!f.endsWith('.json')) continue
    const m = /^(.*?)(?: \((\d+)\))?\.json$/.exec(f)
    if (!m) continue
    const base = m[1]!
    const num  = m[2] ? Number(m[2]) : -1
    const arr = buckets.get(base) ?? []
    arr.push({ n: num, file: f })
    buckets.set(base, arr)
  }
  const out: Winner[] = []
  for (const [slug, candidates] of buckets) {
    candidates.sort((a, b) => b.n - a.n) // highest first
    for (const c of candidates) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(SCRAPE_DIR, c.file), 'utf-8')
        ) as ScrapeRecord
        out.push({ slug, file: c.file, data })
        break
      } catch {
        // fall through to next candidate
      }
    }
  }
  return out
}

// =============================================================================
// Build the merged Card record from existing + scrape
// =============================================================================

interface FieldDiff { field: string; before: unknown; after: unknown }

function lc(s: string): string { return s.toLowerCase() }

/** Loose-normalize a string for "are these the same thing typographically?"
 *  comparisons. Strips diacritics (Rōnin → Ronin), lowercases, and removes
 *  spaces / hyphens / underscores. Used to decide when emeralddb's plain-ASCII
 *  trait or name only differs from our typographically-correct version in
 *  formatting — in which case we keep ours and store theirs as the ASCII alias. */
function looseNormalize(s: string): string {
  return s.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip combining diacritics
    .toLowerCase()
    .replace(/[\s_-]/g, '')             // collapse spacing/hyphens
}
function asciiSameAs(a: string, b: string): boolean {
  return looseNormalize(a) === looseNormalize(b)
}
function traitsLooseEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!asciiSameAs(a[i]!, b[i]!)) return false
  }
  return true
}
function arraysExactEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function mergeRecord(
  before: CardRecord,
  scrape: ScrapeRecord,
  imagePath: string | null,
): { after: CardRecord; diffs: FieldDiff[] } {
  const after: CardRecord = {
    id: before.id,
    gameId: before.gameId,
    setId: before.setId,
    publisherId: before.publisherId,
  }

  const setIfPresent = <K extends keyof CardRecord>(key: K, value: CardRecord[K] | null | undefined): void => {
    if (value !== null && value !== undefined && value !== '') {
      after[key] = value as CardRecord[K]
    }
  }

  // Resolve type once — used by clan/stat/trait policies below.
  const resolvedType = (scrape.type ?? before.type ?? '').trim()
  const tLower = resolvedType.toLowerCase()

  // Direct mappings.
  setIfPresent('type', scrape.type ?? before.type)
  if (typeof scrape.unique === 'boolean' && scrape.unique) after.unique = true
  setIfPresent('text', scrape.text ?? before.text)
  setIfPresent('flavorText', scrape.flavorText)
  setIfPresent('illustrator', scrape.illustrator)

  // Name policy:
  //   - If our existing name and the scrape name only differ by ASCII
  //     normalization (macrons, hyphens, casing), keep ours as the display
  //     name and store the scrape's plain-ASCII form on `nameAscii` so search
  //     matches typed ASCII queries. e.g. "Wandering Rōnin" / "Wandering Ronin".
  //   - Otherwise prefer the scrape's name as authoritative.
  if (scrape.name && before.name && asciiSameAs(scrape.name, before.name)) {
    after.name = before.name
    if (scrape.name !== before.name) after.nameAscii = scrape.name
  } else {
    setIfPresent('name', scrape.name ?? before.name)
  }

  // Faction → clan.
  // Role cards (Keeper/Seeker roles + "Support of [Clan]") don't have a clan
  // field — leave undefined regardless of what the scrape says.
  if (tLower !== 'role') {
    setIfPresent('clan', scrape.faction ?? before.clan)
  }

  // Deck side. Scrape uses "Dynasty" / "Conflict" / "Province" — we store lowercase,
  // but only dynasty + conflict are valid deck values; Province isn't a deck side.
  if (scrape.deck) {
    const lower = lc(scrape.deck)
    if (lower === 'dynasty' || lower === 'conflict') after.deck = lower
    // Province cards: leave deck undefined (matches our existing convention)
  } else if (before.deck) {
    after.deck = before.deck
  }

  // Numeric stats.
  if (scrape.cost          != null) after.cost = scrape.cost
  if (scrape.glory         != null) after.glory = scrape.glory
  if (scrape.strength      != null) after.strength = scrape.strength
  if (scrape.honor         != null) after.honor = scrape.honor
  if (scrape.fate          != null) after.fate = scrape.fate
  if (scrape.influencePool != null) after.influencePool = scrape.influencePool
  if (scrape.influenceCost != null) after.influence = scrape.influenceCost   // scrape's "influenceCost" → our "influence"

  // Military / political — split by card type.
  if (scrape.military != null && scrape.military !== '') {
    if (tLower === 'attachment') after.militaryBonus = scrape.military
    else after.military = scrape.military
  }
  if (scrape.political != null && scrape.political !== '') {
    if (tLower === 'attachment') after.politicalBonus = scrape.political
    else after.political = scrape.political
  }

  // Traits policy:
  //   - If our existing card has no traits (e.g. Good Omen), leave it traitless
  //     even if the scrape proposes some. The scrape sometimes invents traits
  //     for cards the rules don't grant any.
  //   - If both have traits and they only differ by ASCII normalization
  //     (Yōjimbō → Yojimbo, Battle Maiden vs Battle-Maiden), keep ours as the
  //     display list and store the scrape's plain-ASCII list on `traitsAscii`
  //     for search.
  //   - Otherwise replace from scrape.
  const beforeTraits = before.traits ?? []
  const scrapeTraits = scrape.traits ?? []
  if (scrapeTraits.length > 0) {
    if (beforeTraits.length === 0) {
      // Don't add traits to a card we currently treat as traitless (Good Omen rule).
    } else if (traitsLooseEqual(beforeTraits, scrapeTraits)) {
      after.traits = beforeTraits
      if (!arraysExactEqual(beforeTraits, scrapeTraits)) {
        after.traitsAscii = scrapeTraits
      }
    } else {
      after.traits = scrapeTraits
    }
  } else if (beforeTraits.length > 0) {
    after.traits = beforeTraits
  }

  // Rulings: replace entirely from scrape (per user decision).
  if (scrape.rulings && scrape.rulings.length > 0) {
    after.rulings = scrape.rulings
      .filter((r) => (r?.text ?? '').trim().length > 0)
      .map((r) => {
        const obj: { date?: string; source?: string; sourceUrl?: string; text?: string } = {}
        if (r.source)    obj.source = r.source
        if (r.sourceUrl) obj.sourceUrl = r.sourceUrl
        if (r.text)      obj.text = r.text
        return obj
      })
  }

  // Image.
  if (imagePath) after.imagePath = imagePath

  // Preserve project-specific fields that the scrape doesn't know about.
  if (before.flipSideOf) after.flipSideOf = before.flipSideOf
  if (before.errata) after.errata = before.errata
  // Drop unverified — we now have authoritative data.

  // Compute diffs for the dry-run summary.
  const diffs: FieldDiff[] = []
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const k of allKeys) {
    const a = (before as Record<string, unknown>)[k]
    const b = (after as Record<string, unknown>)[k]
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs.push({ field: k, before: a, after: b })
    }
  }
  return { after, diffs }
}

// =============================================================================
// Image move plan
// =============================================================================

interface ImagePlan {
  cardId: string
  srcFile: string         // basename inside SCRAPE_DIR
  destFile: string        // basename inside IMG_DEST_DIR
  urlPath: string         // record.imagePath value
}

function planImageMove(cardId: string, scrape: ScrapeRecord): ImagePlan | null {
  const saved = scrape.image?.savedAs
  if (!saved) return null
  const src = path.join(SCRAPE_DIR, saved)
  if (!fs.existsSync(src)) return null
  const ext = path.extname(saved).toLowerCase() || '.jpg'
  const destFile = `${cardId}${ext}`
  return {
    cardId,
    srcFile: saved,
    destFile,
    urlPath: `${IMG_URL_PREFIX}/${destFile}`,
  }
}

// =============================================================================
// Main
// =============================================================================

function main(): void {
  if (!fs.existsSync(SCRAPE_DIR)) {
    console.error(`[merge] Scrape directory not found: ${SCRAPE_DIR}`)
    process.exit(1)
  }
  if (!fs.existsSync(CARDS_FILE)) {
    console.error(`[merge] Cards file not found: ${CARDS_FILE}`)
    process.exit(1)
  }

  const existing = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8')) as CardRecord[]
  const byId = new Map(existing.map((c) => [c.id, c] as const))
  const byNameLc = new Map<string, CardRecord>()
  for (const c of existing) if (c.name) byNameLc.set(c.name.toLowerCase(), c)

  const winners = listScrapeWinners()
  console.log(`[merge] scrape winners: ${winners.length}`)

  // Drop stray scrape-test entries. These have the same collectorNumber as
  // their real counterparts so they'd otherwise collide on the same record.
  const SKIP_SLUGS = new Set(['test-above-question', 'cavalry-reserves-test'])

  // Pair scrape winners with existing card records.
  interface Plan {
    cardId: string
    slug: string
    before: CardRecord
    after: CardRecord
    diffs: FieldDiff[]
    image: ImagePlan | null
  }
  const plans: Plan[] = []
  const unmatched: string[] = []
  const seenIds = new Set<string>()

  for (const w of winners) {
    if (SKIP_SLUGS.has(w.slug)) continue
    const cn = w.data.collectorNumber
    let target: CardRecord | undefined = undefined
    if (cn != null) {
      const cid = `core-set-${String(cn).padStart(3, '0')}`
      target = byId.get(cid)
    }
    if (!target && w.data.name) {
      target = byNameLc.get(w.data.name.toLowerCase())
    }
    if (!target) {
      unmatched.push(`${w.slug} (collector=${cn ?? '?'}, name=${w.data.name ?? '?'})`)
      continue
    }
    if (seenIds.has(target.id)) {
      // Two scrape winners hit the same target — second one wins if needed,
      // but flag.
      console.warn(`[merge] duplicate target ${target.id} via slug ${w.slug}`)
    }
    seenIds.add(target.id)
    const image = planImageMove(target.id, w.data)
    const { after, diffs } = mergeRecord(target, w.data, image?.urlPath ?? null)
    plans.push({ cardId: target.id, slug: w.slug, before: target, after, diffs, image })
  }

  // Cards in existing that didn't get a scrape match — left untouched, just reported.
  const matchedIds = new Set(plans.map((p) => p.cardId))
  const skipped = existing.filter((c) => !matchedIds.has(c.id))

  // ---------- Summary ----------
  console.log(`\n[merge] === summary ===`)
  console.log(`  scrape winners matched   : ${plans.length}`)
  console.log(`  scrape winners unmatched : ${unmatched.length}`)
  console.log(`  existing cards untouched : ${skipped.length}`)

  // Per-field change counts.
  const fieldChange = new Map<string, number>()
  for (const p of plans) {
    for (const d of p.diffs) {
      fieldChange.set(d.field, (fieldChange.get(d.field) ?? 0) + 1)
    }
  }
  const fields = Array.from(fieldChange.entries()).sort((a, b) => b[1] - a[1])
  console.log(`\n[merge] fields touched (count of cards whose value changes):`)
  for (const [f, n] of fields) console.log(`   ${f.padEnd(20)} ${n}`)

  // Card-type distribution of mil/pol split.
  const typeCounts = new Map<string, number>()
  for (const p of plans) {
    const t = p.after.type ?? '(unknown)'
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  }
  console.log(`\n[merge] cards by type (merged):`)
  for (const [t, n] of Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${t.padEnd(14)} ${n}`)
  }

  // Image plan stats.
  const withImage = plans.filter((p) => p.image).length
  const missingImage = plans.filter((p) => !p.image)
  console.log(`\n[merge] images:`)
  console.log(`   cards with image plan    : ${withImage}/${plans.length}`)
  console.log(`   cards missing image      : ${missingImage.length}`)
  for (const p of missingImage.slice(0, 5)) {
    console.log(`     ${p.cardId} (${p.slug})`)
  }

  // Surface the small-cardinality change buckets so we can sanity-check them.
  const interesting = ['name', 'nameAscii', 'clan', 'traits', 'traitsAscii']
  for (const field of interesting) {
    const hits = plans
      .map((p) => ({ p, diff: p.diffs.find((d) => d.field === field) }))
      .filter((x): x is { p: Plan; diff: FieldDiff } => !!x.diff)
    if (hits.length === 0) continue
    console.log(`\n[merge] cards whose ${field} changes (${hits.length}):`)
    for (const { p, diff } of hits) {
      const before = JSON.stringify(diff.before)
      const after  = JSON.stringify(diff.after)
      console.log(`   ${p.cardId}  [${p.before.name}]  ${before}  →  ${after}`)
    }
  }

  if (unmatched.length) {
    console.log(`\n[merge] UNMATCHED scrape winners (first 10):`)
    for (const u of unmatched.slice(0, 10)) console.log(`   ${u}`)
  }
  if (skipped.length) {
    console.log(`\n[merge] existing cards with NO scrape match (first 10):`)
    for (const c of skipped.slice(0, 10)) console.log(`   ${c.id} (${c.name})`)
  }

  if (!APPLY) {
    console.log(`\n[merge] DRY-RUN. Re-run with --apply to write data + move images.`)
    return
  }

  // ---------- Apply ----------
  console.log(`\n[merge] APPLYING…`)

  // 1) Move images.
  if (!fs.existsSync(IMG_DEST_DIR)) fs.mkdirSync(IMG_DEST_DIR, { recursive: true })
  let imgMoved = 0, imgErrors = 0
  for (const p of plans) {
    if (!p.image) continue
    const src  = path.join(SCRAPE_DIR, p.image.srcFile)
    const dest = path.join(IMG_DEST_DIR, p.image.destFile)
    try {
      fs.renameSync(src, dest)
      imgMoved++
    } catch (err: unknown) {
      // Fallback: try copy (rename can fail across volumes on Windows).
      try {
        fs.copyFileSync(src, dest)
        fs.unlinkSync(src)
        imgMoved++
      } catch (err2: unknown) {
        imgErrors++
        console.warn(`   image error: ${p.image.srcFile} → ${p.image.destFile}: ${(err2 as Error).message}`)
      }
    }
  }
  console.log(`  images moved: ${imgMoved} (errors: ${imgErrors})`)

  // 2) Write the merged card array (sorted by id).
  const idToPlan = new Map(plans.map((p) => [p.cardId, p] as const))
  const next: CardRecord[] = existing
    .map((c) => idToPlan.get(c.id)?.after ?? c)
    .sort((a, b) => a.id.localeCompare(b.id))
  fs.writeFileSync(CARDS_FILE, JSON.stringify(next, null, 2) + '\n', 'utf-8')
  console.log(`  wrote ${next.length} records to ${path.relative(PROJECT_ROOT, CARDS_FILE)}`)
  console.log(`  ${plans.length} replaced, ${next.length - plans.length} untouched.`)
}

main()
