import fs from 'node:fs/promises'
import path from 'node:path'
import type { MutableState } from '../../src/types/data'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const DATA_DIR = path.join(PROJECT_ROOT, 'data')

async function readJsonOrDefault<T>(relPath: string, fallback: T): Promise<T> {
  const abs = path.join(DATA_DIR, relPath)
  try {
    const raw = await fs.readFile(abs, 'utf-8')
    return JSON.parse(raw) as T
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback
    }
    throw err
  }
}

async function readJsonlOrEmpty<T>(relPath: string): Promise<T[]> {
  const abs = path.join(DATA_DIR, relPath)
  try {
    const raw = await fs.readFile(abs, 'utf-8')
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as T)
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }
}

async function listDirJsonFiles(relPath: string): Promise<string[]> {
  const abs = path.join(DATA_DIR, relPath)
  try {
    const entries = await fs.readdir(abs)
    return entries.filter((e) => e.endsWith('.json'))
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }
}

export async function loadMutableState(): Promise<MutableState> {
  const state: MutableState = {
    collection: {},
    decks: [],
    prices: {},
    notes: [],
    wishlist: [],
    sellLists: [],
  }

  // Collection: data/collection/<gameId>.json
  for (const fname of await listDirJsonFiles('collection')) {
    const gameId = fname.replace(/\.json$/, '')
    state.collection[gameId] = await readJsonOrDefault(`collection/${fname}`, {})
  }

  // Decks: data/decks/<gameId>/<deckId>.json
  for (const gameDir of await listDirSubdirs('decks')) {
    for (const fname of await listDirJsonFiles(path.join('decks', gameDir))) {
      const deck = await readJsonOrDefault(`decks/${gameDir}/${fname}`, null)
      if (deck) state.decks.push(deck as MutableState['decks'][number])
    }
  }

  // Prices: data/prices/<gameId>.jsonl
  for (const fname of await listDirEntries('prices')) {
    if (!fname.endsWith('.jsonl')) continue
    const gameId = fname.replace(/\.jsonl$/, '')
    state.prices[gameId] = await readJsonlOrEmpty<MutableState['prices'][string][number]>(`prices/${fname}`)
  }

  // Notes: data/notes/games-played.jsonl
  state.notes = await readJsonlOrEmpty<MutableState['notes'][number]>('notes/games-played.jsonl')

  // Wishlist: data/wishlist.json
  state.wishlist = await readJsonOrDefault('wishlist.json', [])

  // Sell lists: data/sell-lists/*.json
  for (const fname of await listDirJsonFiles('sell-lists')) {
    const list = await readJsonOrDefault(`sell-lists/${fname}`, null)
    if (list) state.sellLists.push(list as MutableState['sellLists'][number])
  }

  return state
}

async function listDirEntries(relPath: string): Promise<string[]> {
  const abs = path.join(DATA_DIR, relPath)
  try {
    return await fs.readdir(abs)
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }
}

async function listDirSubdirs(relPath: string): Promise<string[]> {
  const abs = path.join(DATA_DIR, relPath)
  try {
    const entries = await fs.readdir(abs, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }
}
