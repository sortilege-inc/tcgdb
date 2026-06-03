import type { CollectionEntry, Deck, MutableState, PublisherFilter } from '../types/data'

const DEFAULT_SIDECAR_URL =
  (typeof process !== 'undefined' && process.env?.GATSBY_SIDECAR_URL) || 'http://localhost:8001'

export const READ_ONLY =
  typeof process !== 'undefined' && process.env?.GATSBY_READ_ONLY === 'true'

const EMPTY_STATE: MutableState = {
  collection: {},
  decks: [],
  prices: {},
  notes: [],
  wishlist: [],
  sellLists: [],
}

export class ReadOnlyError extends Error {
  constructor() {
    super('mutation attempted in read-only mode')
    this.name = 'ReadOnlyError'
  }
}

export interface BuiltConflict {
  gameId: string
  cardId: string
  demanded: number
  owned: number
  shortfall: number
  claimedBy: Array<{ deckId: string; deckName: string; qty: number }>
}

export class SidecarError extends Error {
  status: number
  code: string
  conflicts?: BuiltConflict[]
  constructor(status: number, code: string, message: string, conflicts?: BuiltConflict[]) {
    super(message)
    this.name = 'SidecarError'
    this.status = status
    this.code = code
    if (conflicts) this.conflicts = conflicts
  }
}

export async function fetchState(): Promise<MutableState> {
  if (READ_ONLY) {
    // In read-only mode the static bundle should be loaded instead. For now,
    // Phase 0 returns the empty state so the build is functional. Phase 9
    // wires in the bundled snapshot.
    return EMPTY_STATE
  }
  try {
    const res = await fetch(`${DEFAULT_SIDECAR_URL}/api/state`)
    if (!res.ok) throw new Error(`sidecar /api/state -> ${res.status}`)
    return (await res.json()) as MutableState
  } catch (err) {
    console.warn('[tcgdb] sidecar unreachable; using empty state', err)
    return EMPTY_STATE
  }
}

export function emptyState(): MutableState {
  return EMPTY_STATE
}

export interface SetCollectionInput {
  qty?: number
  promoQty?: number
  notes?: string
  /**
   * Internal audit flag. Omit it (default) when called from UI controls — the
   * sidecar interprets the absence as "manual edit, clear any unverified".
   * Pass `true` explicitly only when re-flagging from a script.
   */
  unverified?: boolean
}

export interface SetCollectionResult {
  gameId: string
  cardId: string
  entry: CollectionEntry | null
}

export async function setCollectionEntry(
  gameId: string,
  cardId: string,
  input: SetCollectionInput
): Promise<SetCollectionResult> {
  if (READ_ONLY) throw new ReadOnlyError()
  const res = await fetch(`${DEFAULT_SIDECAR_URL}/api/collection/${gameId}/${cardId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = (await res.json().catch(() => null)) as
    | { ok: true; gameId: string; cardId: string; entry: CollectionEntry | null }
    | { ok: false; error: { code: string; message: string }; conflicts?: BuiltConflict[] }
    | null
  if (!res.ok || !body || body.ok === false) {
    const code = body && 'error' in body ? body.error.code : 'sidecar-error'
    const message = body && 'error' in body ? body.error.message : `HTTP ${res.status}`
    const conflicts = body && 'conflicts' in body ? body.conflicts : undefined
    throw new SidecarError(res.status, code, message, conflicts)
  }
  return { gameId: body.gameId, cardId: body.cardId, entry: body.entry }
}

// ---------- Decks --------------------------------------------------------

export interface CreateDeckInput {
  gameId: string
  formatId: string
  name: string
  origin?: 'own' | 'imported'
  importedFrom?: string
  zones?: Record<string, { cardId: string; qty: number }[]>
  enforceErrata?: boolean
  publisherFilter?: PublisherFilter
  notes?: string
}

export interface PatchDeckInput {
  name?: string
  formatId?: string
  origin?: 'own' | 'imported'
  importedFrom?: string
  zones?: Record<string, { cardId: string; qty: number }[]>
  built?: boolean
  enforceErrata?: boolean
  publisherFilter?: PublisherFilter
  notes?: string
}

async function parseDeckResponse(res: Response): Promise<Deck> {
  const body = (await res.json().catch(() => null)) as
    | { ok: true; deck: Deck }
    | { ok: false; error: { code: string; message: string }; conflicts?: BuiltConflict[] }
    | null
  if (!res.ok || !body || body.ok === false) {
    const code = body && 'error' in body ? body.error.code : 'sidecar-error'
    const message = body && 'error' in body ? body.error.message : `HTTP ${res.status}`
    const conflicts = body && 'conflicts' in body ? body.conflicts : undefined
    throw new SidecarError(res.status, code, message, conflicts)
  }
  return body.deck
}

export async function createDeck(input: CreateDeckInput): Promise<Deck> {
  if (READ_ONLY) throw new ReadOnlyError()
  const res = await fetch(`${DEFAULT_SIDECAR_URL}/api/decks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseDeckResponse(res)
}

export async function patchDeck(
  gameId: string,
  deckId: string,
  input: PatchDeckInput
): Promise<Deck> {
  if (READ_ONLY) throw new ReadOnlyError()
  const res = await fetch(`${DEFAULT_SIDECAR_URL}/api/decks/${gameId}/${deckId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseDeckResponse(res)
}

export async function deleteDeck(gameId: string, deckId: string): Promise<void> {
  if (READ_ONLY) throw new ReadOnlyError()
  const res = await fetch(`${DEFAULT_SIDECAR_URL}/api/decks/${gameId}/${deckId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { ok: false; error: { code: string; message: string } }
      | null
    const code = body?.error?.code ?? 'sidecar-error'
    const message = body?.error?.message ?? `HTTP ${res.status}`
    throw new SidecarError(res.status, code, message)
  }
}
