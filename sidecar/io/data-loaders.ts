/**
 * Shared, file-system-backed data loaders used by route handlers when they
 * need to project the *current* on-disk state for invariant checks.
 *
 * These read fresh on each call — invariant checks run during single
 * mutation requests, so the cost is bounded.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import type { BuildableDeck, CollectionMap } from '../invariants/built-decks'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const DATA_DIR = path.join(PROJECT_ROOT, 'data')

async function listDir(p: string): Promise<string[]> {
  try {
    return await fs.readdir(p)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

async function readJsonOr<T>(p: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf-8')) as T
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw err
  }
}

/** Every deck across all games, normalised to the BuildableDeck shape. */
export async function loadAllDecks(): Promise<BuildableDeck[]> {
  const decksDir = path.join(DATA_DIR, 'decks')
  const out: BuildableDeck[] = []
  for (const gameDir of await listDir(decksDir)) {
    const abs = path.join(decksDir, gameDir)
    try {
      const stat = await fs.stat(abs)
      if (!stat.isDirectory()) continue
    } catch {
      continue
    }
    for (const fname of await listDir(abs)) {
      if (!fname.endsWith('.json')) continue
      const deck = await readJsonOr<BuildableDeck | null>(path.join(abs, fname), null)
      if (deck && deck.id && deck.gameId) out.push(deck)
    }
  }
  return out
}

/** All decks belonging to one game. */
export async function loadDecksForGame(gameId: string): Promise<BuildableDeck[]> {
  const all = await loadAllDecks()
  return all.filter((d) => d.gameId === gameId)
}

/** The full collection map across all games. */
export async function loadCollection(): Promise<CollectionMap> {
  const collDir = path.join(DATA_DIR, 'collection')
  const out: CollectionMap = {}
  for (const fname of await listDir(collDir)) {
    if (!fname.endsWith('.json')) continue
    const gameId = fname.replace(/\.json$/, '')
    out[gameId] = await readJsonOr<CollectionMap[string]>(
      path.join(collDir, fname),
      {}
    )
  }
  return out
}
