/**
 * Merge an arbitrary set of EmeraldDB scrape directories into our
 * data/cards/l5r-lcg/<setId>.json files.
 *
 *   - For each .json in each scrape dir, read scrape.set, slugify to a setId
 *     (lowercase, drop apostrophes, replace whitespace with hyphens), and
 *     route the card record there.
 *   - Existing records are matched by collectorNumber (→ <setId>-NNN) with a
 *     case-insensitive name fallback. Empty-set files (the 6 we stubbed for
 *     Ancient Secrets / Shadows of Doubt / etc.) get fresh records created.
 *
 *   Mapping (identical to merge-emerald-core.ts):
 *     - scrape.faction              → record.clan  (except Role cards)
 *     - scrape.deck Dynasty/Conflict → record.deck (lowercased)
 *                  Province → unset
 *     - Character mil/pol → record.military/political (str)
 *     - Attachment mil/pol → record.militaryBonus/politicalBonus
 *     - scrape numeric fields verbatim; influenceCost → record.influence
 *     - scrape text/flavorText/traits/illustrator/unique/type verbatim
 *     - scrape rulings[] → record.rulings[] (replace)
 *     - scrape.image.savedAs → moved to static/cards/l5r-lcg/<cardId>.<ext>
 *
 *   Preserved from existing record (when matched):
 *     id, gameId, setId, publisherId, flipSideOf, errata
 *
 *   Policies (also identical to core merge):
 *     - Macron-preserving name: scrape.name vs before.name ASCII-equal → keep
 *       before.name as display; store scrape.name on nameAscii.
 *     - Role cards: no clan.
 *     - Good Omen rule: if before.traits is empty, don't add scrape traits.
 *     - Macron-preserving traits: scrape.traits vs before.traits loose-equal but
 *       not exact-equal → keep before; store scrape on traitsAscii.
 *
 *   New records (no existing match — used for the 6 stubbed sets):
 *     - No before-record comparison; scrape data is the source of truth.
 *     - cardId = <setId>-<collectorNumber:03d>
 *
 *   Dedup within a scrape dir: highest (N) suffix per slug wins; bare loses.
 *   Skipped slugs: emeralddb test entries ('test-above-question',
 *                  'cavalry-reserves-test').
 *
 *   Usage:
 *     tsx scripts/merge-emerald-scrape.ts <dir> [<dir> ...]            # dry-run
 *     tsx scripts/merge-emerald-scrape.ts <dir> [<dir> ...] --apply
 */
import fs from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')
const SCRAPE_DIRS = process.argv.slice(2).filter((a) => !a.startsWith('--'))

// Force unbuffered stdout so output is visible to a tail/poll while the
// script runs (when redirected to a file, Node block-buffers ~8KB by default).
const log = (m: string): void => { process.stderr.write(m + '\n') }

if (SCRAPE_DIRS.length === 0) {
  console.error('usage: tsx scripts/merge-emerald-scrape.ts <dir> [<dir> ...] [--apply]')
  process.exit(2)
}

const PROJECT_ROOT = path.resolve(__dirname, '..')
const CARDS_ROOT   = path.join(PROJECT_ROOT, 'data', 'cards', 'l5r-lcg')
const SETS_ROOT    = path.join(PROJECT_ROOT, 'data', 'sets', 'l5r-lcg')
const IMG_DEST_DIR = path.join(PROJECT_ROOT, 'static', 'cards', 'l5r-lcg')
const IMG_URL_PREFIX = '/cards/l5r-lcg'

// =============================================================================
// Types (lifted from merge-emerald-core.ts)
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
  set?: string | null
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
// Helpers
// =============================================================================

function slugifySetName(name: string): string {
  return name.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, '-')
}

function lc(s: string): string { return s.toLowerCase() }

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
  for (let i = 0; i < a.length; i++) if (!asciiSameAs(a[i]!, b[i]!)) return false
  return true
}
function arraysExactEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

const SKIP_SLUGS = new Set([
  // Stray emeralddb test entries.
  'test-above-question',
  'cavalry-reserves-test',
  // Under Fu Leng's Shadow co-op variants — their non-coop slug already
  // merges into the matching b-side record (which models the coop face via
  // flipSideOf). The coop slug would collide on the same target.
  'akuma-no-oni-coop',
  'atsuko-the-calamitous-coop',
  'the-obsidian-flower-coop',
])

// =============================================================================
// Pick scrape winners per dir (highest suffix per slug)
// =============================================================================

interface Winner {
  slug: string
  file: string          // basename within sourceDir
  sourceDir: string     // absolute path
  data: ScrapeRecord
}

function listScrapeWinners(dir: string): Winner[] {
  const buckets = new Map<string, Array<{ n: number; file: string }>>()
  for (const f of fs.readdirSync(dir)) {
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
          fs.readFileSync(path.join(dir, c.file), 'utf-8')
        ) as ScrapeRecord
        out.push({ slug, file: c.file, sourceDir: dir, data })
        break
      } catch {
        // fall through to next candidate
      }
    }
  }
  return out
}

// =============================================================================
// Merge a single scrape record into / over a Card record
// =============================================================================

interface FieldDiff { field: string; before: unknown; after: unknown }

function mergeRecord(
  before: CardRecord,
  scrape: ScrapeRecord,
  imagePath: string | null,
  isNewRecord: boolean,
): { after: CardRecord; diffs: FieldDiff[] } {
  const after: CardRecord = {
    id: before.id,
    gameId: before.gameId,
    setId: before.setId,
    publisherId: before.publisherId,
  }
  const setIfPresent = <K extends keyof CardRecord>(
    key: K, value: CardRecord[K] | null | undefined
  ): void => {
    if (value !== null && value !== undefined && value !== '') {
      after[key] = value as CardRecord[K]
    }
  }

  const resolvedType = (scrape.type ?? before.type ?? '').trim()
  const tLower = resolvedType.toLowerCase()

  setIfPresent('type', scrape.type ?? before.type)
  if (typeof scrape.unique === 'boolean' && scrape.unique) after.unique = true
  setIfPresent('text', scrape.text ?? before.text)
  setIfPresent('flavorText', scrape.flavorText)
  setIfPresent('illustrator', scrape.illustrator)

  // Name: macron-preserving comparison only meaningful when we have a real
  // before-name to compare against. For new records, trust the scrape.
  if (!isNewRecord && scrape.name && before.name && asciiSameAs(scrape.name, before.name)) {
    after.name = before.name
    if (scrape.name !== before.name) after.nameAscii = scrape.name
  } else {
    setIfPresent('name', scrape.name ?? before.name)
  }

  // Clan: skipped for Role cards.
  if (tLower !== 'role') {
    setIfPresent('clan', scrape.faction ?? before.clan)
  }

  // Deck side.
  if (scrape.deck) {
    const lower = lc(scrape.deck)
    if (lower === 'dynasty' || lower === 'conflict') after.deck = lower
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
  if (scrape.influenceCost != null) after.influence = scrape.influenceCost

  // Mil/pol split by type.
  if (scrape.military != null && scrape.military !== '') {
    if (tLower === 'attachment') after.militaryBonus = scrape.military
    else after.military = scrape.military
  }
  if (scrape.political != null && scrape.political !== '') {
    if (tLower === 'attachment') after.politicalBonus = scrape.political
    else after.political = scrape.political
  }

  // Traits:
  //   - new record: trust scrape
  //   - existing traitless record: Good Omen rule — keep traitless
  //   - existing traits loose-equal scrape: keep ours (display), store scrape on traitsAscii
  //   - otherwise: replace from scrape
  const beforeTraits = before.traits ?? []
  const scrapeTraits = scrape.traits ?? []
  if (isNewRecord) {
    if (scrapeTraits.length > 0) after.traits = scrapeTraits
  } else if (scrapeTraits.length > 0) {
    if (beforeTraits.length === 0) {
      // Good Omen rule: don't add traits.
    } else if (traitsLooseEqual(beforeTraits, scrapeTraits)) {
      after.traits = beforeTraits
      if (!arraysExactEqual(beforeTraits, scrapeTraits)) after.traitsAscii = scrapeTraits
    } else {
      after.traits = scrapeTraits
    }
  } else if (beforeTraits.length > 0) {
    after.traits = beforeTraits
  }

  // Rulings: replace entirely from scrape.
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

  if (imagePath) after.imagePath = imagePath

  // Preserve project-specific fields when we have them. These are fields
  // the EmeraldDB scrape doesn't carry — they're authored by hand or by
  // separate migration scripts (deck-validation metadata, role classifiers,
  // province elements, etc.). Without this, a re-merge would silently wipe them.
  if (before.flipSideOf) after.flipSideOf = before.flipSideOf
  if (before.errata) after.errata = before.errata
  if (before.elements) after.elements = before.elements
  if (before.fateIncome != null) after.fateIncome = before.fateIncome
  if (before.deckLimit != null) after.deckLimit = before.deckLimit
  if (before.legalIn) after.legalIn = before.legalIn
  if (before.roleRestriction) after.roleRestriction = before.roleRestriction
  if (before.roleClassifier) after.roleClassifier = before.roleClassifier
  if (before.roleRing) after.roleRing = before.roleRing
  if (before.roleClan) after.roleClan = before.roleClan
  if (before.influenceBonus != null) after.influenceBonus = before.influenceBonus
  if (before.forcesSplashClan) after.forcesSplashClan = before.forcesSplashClan

  // Diff vs before for reporting.
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
  srcAbs: string          // absolute path
  destFile: string        // basename inside IMG_DEST_DIR
  urlPath: string         // record.imagePath value
}

/** Plan the image move without touching the filesystem. We trust the scrape's
 *  recorded `image.savedAs` basename; if the file isn't actually there at apply
 *  time, the rename will fail and we'll log it then. Doing fs.existsSync here
 *  triggers OneDrive on-demand hydration per file, which can take seconds. */
function planImageMove(cardId: string, w: Winner): ImagePlan | null {
  const saved = w.data.image?.savedAs
  if (!saved) return null
  const src = path.join(w.sourceDir, saved)
  const ext = path.extname(saved).toLowerCase() || '.jpg'
  const destFile = `${cardId}${ext}`
  return {
    cardId,
    srcAbs: src,
    destFile,
    urlPath: `${IMG_URL_PREFIX}/${destFile}`,
  }
}

// =============================================================================
// Main
// =============================================================================

interface SetPlan {
  setId: string
  cardsFile: string
  existing: CardRecord[]
  byId: Map<string, CardRecord>
  byNameLc: Map<string, CardRecord>
  winners: Winner[]
  isNewSet: boolean
}

interface RecordPlan {
  cardId: string
  slug: string
  setId: string
  before: CardRecord
  after: CardRecord
  diffs: FieldDiff[]
  image: ImagePlan | null
  isNewRecord: boolean
}

function main(): void {
  const t0 = Date.now()
  const ms = (): string => `${((Date.now() - t0) / 1000).toFixed(1)}s`

  // Smoke-check every scrape dir up front; fail fast.
  for (const d of SCRAPE_DIRS) {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) {
      console.error(`[merge] scrape dir not found: ${d}`)
      process.exit(1)
    }
  }

  // Collect winners from every dir.
  log(`[${ms()}] reading scrape winners…`)
  const allWinners: Winner[] = []
  for (const d of SCRAPE_DIRS) {
    const w = listScrapeWinners(d)
    log(`[${ms()}]   ${path.basename(d)}: ${w.length} winners`)
    allWinners.push(...w)
  }
  log(`[${ms()}] total winners: ${allWinners.length}`)

  // Group by setId.
  log(`[${ms()}] grouping by setId…`)
  const bySet = new Map<string, Winner[]>()
  let withoutSet = 0
  for (const w of allWinners) {
    if (SKIP_SLUGS.has(w.slug)) continue
    const sn = w.data.set
    if (!sn) { withoutSet++; continue }
    const setId = slugifySetName(sn)
    const arr = bySet.get(setId) ?? []
    arr.push(w)
    bySet.set(setId, arr)
  }
  log(`[${ms()}] ${bySet.size} distinct setIds, ${withoutSet} winners with no set`)

  // Prepare per-set state.
  log(`[${ms()}] loading existing card files…`)
  const setPlans: SetPlan[] = []
  const missingFiles: string[] = []
  for (const [setId, winners] of bySet) {
    const cardsFile = path.join(CARDS_ROOT, `${setId}.json`)
    if (!fs.existsSync(cardsFile)) {
      missingFiles.push(setId)
      continue
    }
    const existing = JSON.parse(fs.readFileSync(cardsFile, 'utf-8')) as CardRecord[]
    const byId = new Map(existing.map((c) => [c.id, c] as const))
    const byNameLc = new Map<string, CardRecord>()
    for (const c of existing) if (c.name) byNameLc.set(c.name.toLowerCase(), c)
    setPlans.push({
      setId, cardsFile, existing, byId, byNameLc, winners,
      isNewSet: existing.length === 0,
    })
  }
  log(`[${ms()}] loaded ${setPlans.length} set files`)
  if (missingFiles.length) {
    log(`[merge] ${missingFiles.length} setIds in scrape have no card file:`)
    for (const m of missingFiles) log(`   ${m}`)
  }

  // Pair winners with existing records (or synthesize fresh records).
  log(`[${ms()}] pairing winners with records + planning images…`)
  const plans: RecordPlan[] = []
  const unmatched: Array<{ setId: string; slug: string; reason: string }> = []
  const dupTargets: Array<{ setId: string; cardId: string; secondSlug: string }> = []
  const stubPub = 'ffg'

  let processed = 0
  for (const sp of setPlans) {
    const setT0 = Date.now()
    const seenIds = new Set<string>()
    for (const w of sp.winners) {
      const cn = w.data.collectorNumber
      let target: CardRecord | undefined
      let isNew = false
      if (cn != null) {
        const cid = `${sp.setId}-${String(cn).padStart(3, '0')}`
        target = sp.byId.get(cid)
      }
      if (!target && w.data.name) {
        target = sp.byNameLc.get(w.data.name.toLowerCase())
      }
      // No existing record by collector or name — if we have a collectorNumber,
      // synthesize a fresh record at <setId>-NNN. This handles both:
      //   - cards in our new stubbed sets (empty existing array)
      //   - cards we never wiki-paste-imported (e.g. defenders-of-rokugan-033 Kikyo)
      if (!target && cn != null) {
        const cid = `${sp.setId}-${String(cn).padStart(3, '0')}`
        target = {
          id: cid, gameId: 'l5r-lcg', setId: sp.setId, publisherId: stubPub,
        }
        isNew = true
      }
      if (!target) {
        unmatched.push({
          setId: sp.setId,
          slug: w.slug,
          reason: `collector=${cn ?? '?'}, name=${w.data.name ?? '?'}`,
        })
        continue
      }
      if (seenIds.has(target.id)) {
        dupTargets.push({ setId: sp.setId, cardId: target.id, secondSlug: w.slug })
      }
      seenIds.add(target.id)
      const image = planImageMove(target.id, w)
      const { after, diffs } = mergeRecord(target, w.data, image?.urlPath ?? null, isNew)
      plans.push({
        cardId: target.id, slug: w.slug, setId: sp.setId,
        before: target, after, diffs, image, isNewRecord: isNew,
      })
      processed++
    }
    const setElapsed = ((Date.now() - setT0) / 1000).toFixed(1)
    log(`[${ms()}]   ${sp.setId.padEnd(34)} ${sp.winners.length} cards in ${setElapsed}s [total processed: ${processed}]`)
  }

  log(`[${ms()}] pairing complete: ${plans.length} plans`)

  // ---------- Summary ----------
  log(`\n[merge] === summary ===`)
  log(`  scrape winners matched : ${plans.length}`)
  log(`  scrape winners unmatched: ${unmatched.length}`)
  log(`  duplicate-target hits  : ${dupTargets.length}`)
  log(`  setIds with no card file: ${missingFiles.length}`)

  // Per-set summary.
  log(`\n[merge] per-set results:`)
  for (const sp of [...setPlans].sort((a, b) => a.setId.localeCompare(b.setId))) {
    const setPlans = plans.filter((p) => p.setId === sp.setId)
    const newCount = setPlans.filter((p) => p.isNewRecord).length
    const updateCount = setPlans.length - newCount
    const tag = sp.isNewSet ? '[NEW SET] ' : ''
    log(
      `  ${tag}${sp.setId.padEnd(34)} ${setPlans.length}/${sp.winners.length} winners` +
      (newCount ? ` (${newCount} new + ${updateCount} updated)` : '')
    )
  }

  // Per-field change totals.
  const fieldChange = new Map<string, number>()
  for (const p of plans) {
    for (const d of p.diffs) fieldChange.set(d.field, (fieldChange.get(d.field) ?? 0) + 1)
  }
  const sortedFields = [...fieldChange.entries()].sort((a, b) => b[1] - a[1])
  log(`\n[merge] fields touched (count of records whose value changes):`)
  for (const [f, n] of sortedFields) log(`   ${f.padEnd(20)} ${n}`)

  // Type distribution.
  const typeCounts = new Map<string, number>()
  for (const p of plans) {
    const t = p.after.type ?? '(unknown)'
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  }
  log(`\n[merge] cards by type (merged):`)
  for (const [t, n] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    log(`   ${t.padEnd(14)} ${n}`)
  }

  // Image stats.
  const withImage = plans.filter((p) => p.image).length
  const missingImage = plans.filter((p) => !p.image)
  log(`\n[merge] images:`)
  log(`   cards with image plan: ${withImage}/${plans.length}`)
  log(`   cards missing image  : ${missingImage.length}`)
  for (const p of missingImage.slice(0, 5)) {
    log(`     ${p.cardId} (${p.slug})`)
  }

  // Small-cardinality change buckets.
  for (const field of ['name', 'nameAscii', 'clan', 'traits', 'traitsAscii']) {
    const hits = plans
      .map((p) => ({ p, diff: p.diffs.find((d) => d.field === field) }))
      .filter((x): x is { p: RecordPlan; diff: FieldDiff } => !!x.diff)
    // Only show updates, not new-record creations (which trivially "change" every field).
    const updates = hits.filter((h) => !h.p.isNewRecord)
    if (updates.length === 0) continue
    log(`\n[merge] existing records whose ${field} changes (${updates.length}):`)
    for (const { p, diff } of updates.slice(0, 30)) {
      const before = JSON.stringify(diff.before)
      const after  = JSON.stringify(diff.after)
      log(`   ${p.cardId.padEnd(28)}  ${before}  →  ${after}`)
    }
    if (updates.length > 30) log(`   …and ${updates.length - 30} more`)
  }

  if (unmatched.length) {
    log(`\n[merge] UNMATCHED scrape winners (first 20):`)
    for (const u of unmatched.slice(0, 20)) {
      log(`   ${u.setId.padEnd(28)} ${u.slug.padEnd(40)} (${u.reason})`)
    }
  }
  if (dupTargets.length) {
    log(`\n[merge] DUPLICATE TARGETS (first 10):`)
    for (const d of dupTargets.slice(0, 10)) {
      log(`   ${d.setId} :: ${d.cardId} via second slug ${d.secondSlug}`)
    }
  }

  if (!APPLY) {
    log(`\n[merge] DRY-RUN. Re-run with --apply to write data + move images.`)
    return
  }

  // ---------- Apply ----------
  log(`\n[merge] APPLYING…`)

  if (!fs.existsSync(IMG_DEST_DIR)) fs.mkdirSync(IMG_DEST_DIR, { recursive: true })

  // 1) Move images. List the destination dir ONCE (single readdir is much
  //    cheaper than per-file existsSync calls, which on Defender-watched
  //    project dirs can take seconds each). Streams progress every 50;
  //    idempotent: any plan whose destFile is already in dest is skipped.
  const imgPlans = plans.filter((p) => p.image)
  log(`[${ms()}] listing existing images in dest…`)
  const destSet = new Set(fs.readdirSync(IMG_DEST_DIR))
  log(`[${ms()}]   dest has ${destSet.size} files`)
  log(`[${ms()}] moving ${imgPlans.length} images…`)
  const imgT0 = Date.now()
  let imgMoved = 0, imgSkipped = 0, imgErrors = 0
  for (let i = 0; i < imgPlans.length; i++) {
    const p = imgPlans[i]!
    const destBase = p.image!.destFile
    if (destSet.has(destBase)) {
      imgSkipped++
    } else {
      const dest = path.join(IMG_DEST_DIR, destBase)
      try {
        fs.renameSync(p.image!.srcAbs, dest)
        imgMoved++
        destSet.add(destBase)
      } catch {
        try {
          fs.copyFileSync(p.image!.srcAbs, dest)
          fs.unlinkSync(p.image!.srcAbs)
          imgMoved++
          destSet.add(destBase)
        } catch (err: unknown) {
          imgErrors++
          if (imgErrors <= 5) {
            log(`   image error: ${path.basename(p.image!.srcAbs)} → ${destBase}: ${(err as Error).message}`)
          }
        }
      }
    }
    if ((i + 1) % 50 === 0 || i + 1 === imgPlans.length) {
      const sec = ((Date.now() - imgT0) / 1000).toFixed(1)
      log(`[${ms()}]   [${i + 1}/${imgPlans.length}] moved=${imgMoved} skipped=${imgSkipped} errors=${imgErrors} (${sec}s)`)
    }
  }
  log(`  images: ${imgMoved} moved, ${imgSkipped} already-there, ${imgErrors} errors`)

  // 2) Per-set, write the merged card array (sorted by id).
  for (const sp of setPlans) {
    const idToPlan = new Map(
      plans.filter((p) => p.setId === sp.setId).map((p) => [p.cardId, p] as const)
    )
    // Start with existing records, replace those that have plans; then append
    // brand-new records for any plan not already in `existing`.
    const next: CardRecord[] = []
    const seen = new Set<string>()
    for (const c of sp.existing) {
      const plan = idToPlan.get(c.id)
      if (plan) {
        next.push(plan.after)
      } else {
        next.push(c)
      }
      seen.add(c.id)
    }
    for (const [cid, plan] of idToPlan) {
      if (!seen.has(cid)) next.push(plan.after)
    }
    next.sort((a, b) => a.id.localeCompare(b.id))
    fs.writeFileSync(sp.cardsFile, JSON.stringify(next, null, 2) + '\n', 'utf-8')

    // Update the set's cardCount.
    const setFile = path.join(SETS_ROOT, `${sp.setId}.json`)
    if (fs.existsSync(setFile)) {
      const setRec = JSON.parse(fs.readFileSync(setFile, 'utf-8')) as Record<string, unknown>
      if (setRec.cardCount !== next.length) {
        setRec.cardCount = next.length
        fs.writeFileSync(setFile, JSON.stringify(setRec, null, 2) + '\n', 'utf-8')
      }
    }
  }
  log(`  wrote ${setPlans.length} set card files.`)
}

main()
