import { Router, type Request, type Response } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { atomicWriteFile, pathMutex } from '../io/atomic-write'
import { loadAllDecks, loadCollection } from '../io/data-loaders'
import { checkWithDeckReplaced } from '../invariants/built-decks'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const DECKS_DIR = path.join(PROJECT_ROOT, 'data', 'decks')

interface DeckEntry { cardId: string; qty: number }
type PublisherFilter =
  | { mode: 'official-only' }
  | { mode: 'include-third-party' }
  | { mode: 'custom'; allowedPublisherIds: string[] }

interface Deck {
  id: string
  gameId: string
  formatId: string
  name: string
  origin: 'own' | 'imported'
  importedFrom?: string
  zones: Record<string, DeckEntry[]>
  built: boolean
  enforceErrata: boolean
  publisherFilter: PublisherFilter
  /** L5R: declared secondary clan for splash (player-set or auto-set on
   *  first out-of-clan add). Undefined = no splash yet (mono-clan). */
  splashClan?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

function sanitiseGameId(gameId: string): string | null {
  return /^[a-z0-9-]{1,64}$/.test(gameId) ? gameId : null
}

function sanitiseDeckId(deckId: string): string | null {
  // UUIDs and short kebab-case ids both acceptable.
  return /^[a-z0-9-]{4,64}$/.test(deckId) ? deckId : null
}

async function deckPath(gameId: string, deckId: string): Promise<string> {
  return path.join(DECKS_DIR, gameId, `${deckId}.json`)
}

async function readDeck(gameId: string, deckId: string): Promise<Deck | null> {
  try {
    const raw = await fs.readFile(await deckPath(gameId, deckId), 'utf-8')
    return JSON.parse(raw) as Deck
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

async function writeDeck(deck: Deck): Promise<void> {
  const target = await deckPath(deck.gameId, deck.id)
  await atomicWriteFile(target, JSON.stringify(deck, null, 2) + '\n')
}

interface CreateDeckBody {
  gameId: string
  formatId: string
  name: string
  origin?: 'own' | 'imported'
  importedFrom?: string
  zones?: Record<string, DeckEntry[]>
  enforceErrata?: boolean
  publisherFilter?: PublisherFilter
  splashClan?: string
  allowedPacks?: string[]
  notes?: string
}

interface PatchDeckBody {
  name?: string
  formatId?: string
  origin?: 'own' | 'imported'
  importedFrom?: string
  zones?: Record<string, DeckEntry[]>
  built?: boolean
  enforceErrata?: boolean
  publisherFilter?: PublisherFilter
  splashClan?: string | null   // pass null to clear
  allowedPacks?: string[] | null   // pass null (or omit) to clear → all packs allowed
  notes?: string
}

/** Sanitise a pack-legality list: keep only non-empty strings, dedupe. */
function normaliseAllowedPacks(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined
  const seen = new Set<string>()
  for (const v of input) {
    if (typeof v === 'string' && v.trim()) seen.add(v.trim())
  }
  return Array.from(seen)
}

function nowIso(): string {
  return new Date().toISOString()
}

function shortId(): string {
  // 22-char uuid with hyphens stripped, then take 12 chars.
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

function normaliseZones(zones: Record<string, DeckEntry[]> | undefined): Record<string, DeckEntry[]> {
  if (!zones) return {}
  const out: Record<string, DeckEntry[]> = {}
  for (const [zoneId, entries] of Object.entries(zones)) {
    if (!Array.isArray(entries)) continue
    const cleaned = entries
      .filter((e): e is DeckEntry => e && typeof e.cardId === 'string' && typeof e.qty === 'number')
      .map((e) => ({ cardId: e.cardId, qty: Math.max(0, Math.floor(e.qty)) }))
      .filter((e) => e.qty > 0)
    out[zoneId] = cleaned
  }
  return out
}

export function decksRouter(): Router {
  const router = Router()

  router.post('/', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as CreateDeckBody
    const gameId = sanitiseGameId(body.gameId ?? '')
    if (!gameId) {
      res.status(400).json({ ok: false, error: { code: 'bad-game-id', message: 'Invalid gameId' } })
      return
    }
    if (!body.formatId || typeof body.formatId !== 'string') {
      res.status(400).json({ ok: false, error: { code: 'bad-format', message: 'formatId required' } })
      return
    }
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ ok: false, error: { code: 'bad-name', message: 'name required' } })
      return
    }

    const id = shortId()
    const created: Deck = {
      id,
      gameId,
      formatId: body.formatId,
      name: body.name.trim(),
      origin: body.origin === 'imported' ? 'imported' : 'own',
      ...(body.importedFrom ? { importedFrom: body.importedFrom } : {}),
      zones: normaliseZones(body.zones),
      // New decks are never created built — they must be toggled built
      // separately, which goes through the invariant check.
      built: false,
      enforceErrata: !!body.enforceErrata,
      publisherFilter: body.publisherFilter ?? { mode: 'official-only' },
      ...(body.splashClan ? { splashClan: body.splashClan } : {}),
      // Absent → all packs allowed. An explicit array (incl. []) restricts
      // the deck editor's card picker to those sets ([] = none).
      ...(Array.isArray(body.allowedPacks)
        ? { allowedPacks: normaliseAllowedPacks(body.allowedPacks) ?? [] }
        : {}),
      ...(body.notes ? { notes: body.notes } : {}),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    try {
      await pathMutex.run(await deckPath(gameId, id), async () => {
        await writeDeck(created)
      })
      res.status(201).json({ ok: true, deck: created })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      res.status(500).json({ ok: false, error: { code: 'deck-write-failed', message } })
    }
  })

  router.patch('/:gameId/:deckId', async (req: Request, res: Response) => {
    const gameId = sanitiseGameId(req.params.gameId ?? '')
    const deckId = sanitiseDeckId(req.params.deckId ?? '')
    if (!gameId || !deckId) {
      res.status(400).json({ ok: false, error: { code: 'bad-id', message: 'Invalid gameId or deckId' } })
      return
    }
    const body = (req.body ?? {}) as PatchDeckBody
    try {
      const result = await pathMutex.run(await deckPath(gameId, deckId), async () => {
        const existing = await readDeck(gameId, deckId)
        if (!existing) return { kind: 'not-found' as const }
        const next: Deck = {
          ...existing,
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.formatId !== undefined ? { formatId: body.formatId } : {}),
          ...(body.origin !== undefined ? { origin: body.origin } : {}),
          ...(body.importedFrom !== undefined ? { importedFrom: body.importedFrom || undefined } : {}),
          ...(body.zones !== undefined ? { zones: normaliseZones(body.zones) } : {}),
          ...(body.built !== undefined ? { built: !!body.built } : {}),
          ...(body.enforceErrata !== undefined ? { enforceErrata: !!body.enforceErrata } : {}),
          ...(body.publisherFilter !== undefined ? { publisherFilter: body.publisherFilter } : {}),
          ...(body.splashClan !== undefined
            ? (body.splashClan === null ? { splashClan: undefined } : { splashClan: body.splashClan })
            : {}),
          // null → clear (undefined = all packs allowed). An array (incl. [])
          // restricts the picker to those sets; [] = none. Omitted → unchanged.
          ...(body.allowedPacks !== undefined
            ? (body.allowedPacks === null
                ? { allowedPacks: undefined }
                : { allowedPacks: normaliseAllowedPacks(body.allowedPacks) ?? [] })
            : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          updatedAt: nowIso(),
        }

        // Built-deck invariant: only check when the resulting state could
        // violate it — i.e. either the next state is built, or this deck is
        // currently built (decreasing zones could starve it of its own
        // claim, though that's unusual).
        const needsCheck = next.built || existing.built
        if (needsCheck) {
          const allDecks = await loadAllDecks()
          const collection = await loadCollection()
          const check = checkWithDeckReplaced(allDecks, next, collection)
          if (!check.ok) {
            return { kind: 'conflict' as const, conflicts: check.conflicts }
          }
        }
        await writeDeck(next)
        return { kind: 'ok' as const, deck: next }
      })

      if (result.kind === 'not-found') {
        res.status(404).json({ ok: false, error: { code: 'not-found', message: 'Deck not found' } })
        return
      }
      if (result.kind === 'conflict') {
        res.status(409).json({
          ok: false,
          error: {
            code: 'built-invariant-violation',
            message: 'This change would leave a built deck without enough copies.',
          },
          conflicts: result.conflicts,
        })
        return
      }
      res.json({ ok: true, deck: result.deck })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      res.status(500).json({ ok: false, error: { code: 'deck-write-failed', message } })
    }
  })

  router.delete('/:gameId/:deckId', async (req: Request, res: Response) => {
    const gameId = sanitiseGameId(req.params.gameId ?? '')
    const deckId = sanitiseDeckId(req.params.deckId ?? '')
    if (!gameId || !deckId) {
      res.status(400).json({ ok: false, error: { code: 'bad-id', message: 'Invalid gameId or deckId' } })
      return
    }
    try {
      const target = await deckPath(gameId, deckId)
      const removed = await pathMutex.run(target, async () => {
        try {
          await fs.unlink(target)
          return true
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
          throw err
        }
      })
      if (!removed) {
        res.status(404).json({ ok: false, error: { code: 'not-found', message: 'Deck not found' } })
        return
      }
      res.json({ ok: true, gameId, deckId })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      res.status(500).json({ ok: false, error: { code: 'deck-delete-failed', message } })
    }
  })

  return router
}
