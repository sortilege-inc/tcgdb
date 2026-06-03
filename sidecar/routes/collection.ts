import { Router, type Request, type Response } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteFile, pathMutex } from '../io/atomic-write'
import { loadAllDecks } from '../io/data-loaders'
import { checkWithCollectionReplaced } from '../invariants/built-decks'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const COLLECTION_DIR = path.join(PROJECT_ROOT, 'data', 'collection')

interface CollectionEntry {
  qty: number
  promoQty: number
  notes?: string
  unverified?: boolean
}

type CollectionFile = Record<string, CollectionEntry>

async function readCollection(gameId: string): Promise<CollectionFile> {
  const filepath = path.join(COLLECTION_DIR, `${gameId}.json`)
  try {
    const raw = await fs.readFile(filepath, 'utf-8')
    return JSON.parse(raw) as CollectionFile
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw err
  }
}

async function writeCollection(gameId: string, data: CollectionFile): Promise<void> {
  const filepath = path.join(COLLECTION_DIR, `${gameId}.json`)
  await atomicWriteFile(filepath, JSON.stringify(data, null, 2) + '\n')
}

function sanitiseGameId(gameId: string): string | null {
  if (!/^[a-z0-9-]{1,64}$/.test(gameId)) return null
  return gameId
}

function sanitiseCardId(cardId: string): string | null {
  if (!/^[a-z0-9-]{1,128}$/.test(cardId)) return null
  return cardId
}

export function collectionRouter(): Router {
  const router = Router()

  // Set absolute qty / promoQty for one card. If both are 0 (or absent),
  // the entry is removed.
  //
  // POST /api/collection/:gameId/:cardId
  // body: { qty?: number, promoQty?: number, notes?: string }
  router.post('/:gameId/:cardId', async (req: Request, res: Response) => {
    const gameId = sanitiseGameId(req.params.gameId ?? '')
    const cardId = sanitiseCardId(req.params.cardId ?? '')
    if (!gameId || !cardId) {
      res.status(400).json({ ok: false, error: { code: 'bad-id', message: 'Invalid gameId or cardId' } })
      return
    }

    const body = (req.body ?? {}) as {
      qty?: number
      promoQty?: number
      notes?: string
      unverified?: boolean
    }
    const { qty, promoQty, notes } = body
    const hasUnverifiedInBody = Object.prototype.hasOwnProperty.call(body, 'unverified')

    const filepath = path.join(COLLECTION_DIR, `${gameId}.json`)

    try {
      const result = await pathMutex.run(filepath, async () => {
        const data = await readCollection(gameId)
        const existing = data[cardId] ?? { qty: 0, promoQty: 0 }
        const next: CollectionEntry = {
          qty: typeof qty === 'number' ? Math.max(0, Math.floor(qty)) : existing.qty,
          promoQty: typeof promoQty === 'number' ? Math.max(0, Math.floor(promoQty)) : existing.promoQty,
        }
        if (typeof notes === 'string') {
          if (notes.trim()) next.notes = notes
        } else if (existing.notes) {
          next.notes = existing.notes
        }
        if (hasUnverifiedInBody) {
          if (body.unverified) next.unverified = true
        }

        // Built-deck invariant: only relevant when qty decreases.
        if (next.qty < existing.qty) {
          const allDecks = await loadAllDecks()
          const check = checkWithCollectionReplaced(allDecks, gameId, cardId, next.qty)
          if (!check.ok) {
            return { kind: 'conflict' as const, conflicts: check.conflicts }
          }
        }

        if (next.qty === 0 && next.promoQty === 0 && !next.notes) {
          delete data[cardId]
          await writeCollection(gameId, data)
          return { kind: 'ok' as const, entry: null }
        }
        data[cardId] = next
        await writeCollection(gameId, data)
        return { kind: 'ok' as const, entry: next }
      })
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
      res.json({ ok: true, gameId, cardId, entry: result.entry })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      res.status(500).json({ ok: false, error: { code: 'collection-write-failed', message } })
    }
  })

  // Explicit DELETE for clarity; same effect as POST with qty=0,promoQty=0.
  router.delete('/:gameId/:cardId', async (req: Request, res: Response) => {
    const gameId = sanitiseGameId(req.params.gameId ?? '')
    const cardId = sanitiseCardId(req.params.cardId ?? '')
    if (!gameId || !cardId) {
      res.status(400).json({ ok: false, error: { code: 'bad-id', message: 'Invalid gameId or cardId' } })
      return
    }
    const filepath = path.join(COLLECTION_DIR, `${gameId}.json`)
    try {
      await pathMutex.run(filepath, async () => {
        const data = await readCollection(gameId)
        if (cardId in data) {
          delete data[cardId]
          await writeCollection(gameId, data)
        }
      })
      res.json({ ok: true, gameId, cardId, entry: null })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      res.status(500).json({ ok: false, error: { code: 'collection-delete-failed', message } })
    }
  })

  return router
}
