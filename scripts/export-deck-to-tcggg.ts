/**
 * One-off helper: simulate the deck-export envelope tcgdb will produce
 * for tcggg consumption, before we wire the actual Export button.
 *
 * Reads a deck from data/decks/l5r-lcg/, gathers every referenced
 * card's full record from data/cards/l5r-lcg/, and writes:
 *
 *   ../tcggg/public/player-assets/l5r-lcg/decks/<slug>.json
 *   ../tcggg/public/player-assets/l5r-lcg/images/<cardId>.<ext>
 *
 * The JSON envelope shape matches the contract documented in
 * ../tcgdb/CLAUDE.md:
 *   { exportVersion: 1, exportedAt, deck, cards }
 *
 * Card image paths are rewritten to point at the tcggg-local copies
 * (/player-assets/l5r-lcg/images/<file>) so the deck is self-contained.
 *
 * Per the project CLAUDE.md ("long-running scripts: fail fast, surface
 * progress"): smoke-tests one card lookup + one image read up front,
 * streams progress every 10 items, catches per-card errors with a
 * sample, and surfaces totals at the end.
 *
 * Usage:
 *   tsx scripts/export-deck-to-tcggg.ts <deckId>
 *
 * Example:
 *   tsx scripts/export-deck-to-tcggg.ts eb985baf5ec1   # Crane Dominance
 */
import fs from 'node:fs'
import path from 'node:path'

const TCGDB_ROOT = path.resolve(__dirname, '..')
const TCGGG_ROOT = path.resolve(TCGDB_ROOT, '..', 'tcggg')
const DECKS_DIR  = path.join(TCGDB_ROOT, 'data', 'decks', 'l5r-lcg')
const CARDS_DIR  = path.join(TCGDB_ROOT, 'data', 'cards', 'l5r-lcg')
const SRC_IMG    = path.join(TCGDB_ROOT, 'static', 'cards', 'l5r-lcg')

const DEST_BASE  = path.join(TCGGG_ROOT, 'public', 'player-assets', 'l5r-lcg')
const DEST_DECKS = path.join(DEST_BASE, 'decks')
const DEST_IMGS  = path.join(DEST_BASE, 'images')

interface DeckEntry { cardId: string; qty: number }
interface Deck {
  id: string
  gameId: string
  formatId: string
  name: string
  zones: Record<string, DeckEntry[]>
  splashClan?: string
  enforceErrata?: boolean
  notes?: string
  built?: boolean
}
interface Card { id: string; name: string; imagePath?: string; [k: string]: unknown }

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function loadAllCards(): Map<string, Card> {
  const out = new Map<string, Card>()
  for (const f of fs.readdirSync(CARDS_DIR)) {
    if (!f.endsWith('.json')) continue
    const cards = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, f), 'utf-8')) as Card[]
    for (const c of cards) out.set(c.id, c)
  }
  return out
}

function main(): void {
  const deckId = process.argv[2]
  if (!deckId) {
    console.error('usage: tsx scripts/export-deck-to-tcggg.ts <deckId>')
    process.exit(2)
  }
  const deckPath = path.join(DECKS_DIR, `${deckId}.json`)
  if (!fs.existsSync(deckPath)) {
    console.error(`[export] deck not found: ${deckPath}`)
    process.exit(1)
  }
  const deck = JSON.parse(fs.readFileSync(deckPath, 'utf-8')) as Deck

  console.log(`[export] deck: ${deck.name} (${deck.id})`)
  console.log(`[export] format: ${deck.formatId}, splash: ${deck.splashClan ?? '—'}`)

  // Smoke-test: load all cards, find one cardId from the deck, read its
  // image. If either fails, stop before doing 47 copies.
  const catalog = loadAllCards()
  console.log(`[export] catalog loaded: ${catalog.size} cards`)
  const allIds = new Set<string>()
  for (const entries of Object.values(deck.zones ?? {})) for (const e of entries) allIds.add(e.cardId)
  const firstId = [...allIds][0]
  if (!firstId) { console.error('[export] deck has no cards'); process.exit(1) }
  const firstCard = catalog.get(firstId)
  if (!firstCard) { console.error(`[export] smoke-fail: ${firstId} not in catalog`); process.exit(1) }
  console.log(`[export] smoke ok: ${firstId} (${firstCard.name})`)

  // Prepare destination dirs.
  fs.mkdirSync(DEST_DECKS, { recursive: true })
  fs.mkdirSync(DEST_IMGS, { recursive: true })

  // Build cards map + image plan.
  const cards: Record<string, Card> = {}
  const imageJobs: Array<{ cardId: string; src: string; destBase: string }> = []
  const missing: string[] = []
  for (const cardId of allIds) {
    const c = catalog.get(cardId)
    if (!c) { missing.push(cardId); continue }
    // Rewrite imagePath to point at our local copy.
    const ext = c.imagePath ? path.extname(c.imagePath).toLowerCase() || '.jpg' : '.jpg'
    const destBase = `${cardId}${ext}`
    const next: Card = { ...c, imagePath: `/player-assets/l5r-lcg/images/${destBase}` }
    cards[cardId] = next
    // Plan the image copy if a source exists.
    if (c.imagePath) {
      const src = path.join(SRC_IMG, path.basename(c.imagePath))
      imageJobs.push({ cardId, src, destBase })
    }
  }
  if (missing.length) {
    console.warn(`[export] WARNING: ${missing.length} cardIds not in catalog: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`)
  }

  // Copy images with per-N progress.
  console.log(`[export] copying ${imageJobs.length} images…`)
  let copied = 0, alreadyPresent = 0, imgErrors = 0
  const errorSamples: string[] = []
  for (let i = 0; i < imageJobs.length; i++) {
    const job = imageJobs[i]!
    const dest = path.join(DEST_IMGS, job.destBase)
    try {
      if (fs.existsSync(dest)) {
        alreadyPresent++
      } else if (fs.existsSync(job.src)) {
        fs.copyFileSync(job.src, dest)
        copied++
      } else {
        imgErrors++
        if (errorSamples.length < 3) errorSamples.push(`${job.cardId}: src missing ${job.src}`)
      }
    } catch (e: unknown) {
      imgErrors++
      if (errorSamples.length < 3) errorSamples.push(`${job.cardId}: ${(e as Error).message}`)
    }
    if ((i + 1) % 10 === 0 || i + 1 === imageJobs.length) {
      console.log(`  [${i + 1}/${imageJobs.length}] copied=${copied} already-there=${alreadyPresent} errors=${imgErrors}`)
    }
  }
  for (const s of errorSamples) console.log(`  err: ${s}`)

  // Build envelope.
  const envelope = {
    exportVersion: 1 as const,
    exportedAt: new Date().toISOString(),
    deck: {
      id: deck.id,
      gameId: deck.gameId,
      formatId: deck.formatId,
      name: deck.name,
      ...(deck.splashClan ? { splashClan: deck.splashClan } : {}),
      zones: deck.zones,
      ...(deck.enforceErrata !== undefined ? { enforceErrata: deck.enforceErrata } : {}),
      ...(deck.notes ? { notes: deck.notes } : {}),
    },
    cards,
  }
  const outFile = path.join(DEST_DECKS, `${slugify(deck.name)}.json`)
  fs.writeFileSync(outFile, JSON.stringify(envelope, null, 2) + '\n', 'utf-8')
  console.log(`[export] wrote envelope → ${path.relative(TCGGG_ROOT, outFile)}`)
  console.log(`[export] done: ${Object.keys(cards).length} cards, ${copied + alreadyPresent} images on disk.`)
}

main()
