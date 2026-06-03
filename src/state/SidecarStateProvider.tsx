import * as React from 'react'
import type { CollectionEntry, Deck, MutableState } from '../types/data'
import {
  createDeck as apiCreateDeck,
  deleteDeck as apiDeleteDeck,
  emptyState,
  fetchState,
  patchDeck as apiPatchDeck,
  READ_ONLY,
  setCollectionEntry as apiSetCollectionEntry,
  type CreateDeckInput,
  type PatchDeckInput,
  type SetCollectionInput,
} from './sidecar-client'

interface SidecarStateValue {
  state: MutableState
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  readOnly: boolean

  /** Optimistically update one collection entry and persist via the sidecar. */
  setCollectionEntry: (
    gameId: string,
    cardId: string,
    input: SetCollectionInput
  ) => Promise<void>

  /** Create a deck via the sidecar; returns the persisted record. */
  createDeck: (input: CreateDeckInput) => Promise<Deck>
  /** Patch a deck via the sidecar; returns the updated record. */
  patchDeck: (gameId: string, deckId: string, input: PatchDeckInput) => Promise<Deck>
  /** Delete a deck via the sidecar. */
  deleteDeck: (gameId: string, deckId: string) => Promise<void>
}

const SidecarStateContext = React.createContext<SidecarStateValue>({
  state: emptyState(),
  loading: false,
  error: null,
  refresh: async () => {},
  readOnly: READ_ONLY,
  setCollectionEntry: async () => {},
  createDeck: async () => { throw new Error('not initialised') },
  patchDeck: async () => { throw new Error('not initialised') },
  deleteDeck: async () => {},
})

interface Props {
  children: React.ReactNode
}

export function SidecarStateProvider({ children }: Props): React.ReactElement {
  const [state, setState] = React.useState<MutableState>(emptyState())
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchState()
      setState(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const setCollectionEntry = React.useCallback(
    async (gameId: string, cardId: string, input: SetCollectionInput) => {
      // Optimistic update so the UI feels immediate.
      let previousEntry: CollectionEntry | undefined
      const explicitUnverified = Object.prototype.hasOwnProperty.call(input, 'unverified')
      setState((s) => {
        const gameMap = s.collection[gameId] ?? {}
        previousEntry = gameMap[cardId]
        const next: CollectionEntry = {
          qty:
            typeof input.qty === 'number'
              ? Math.max(0, Math.floor(input.qty))
              : previousEntry?.qty ?? 0,
          promoQty:
            typeof input.promoQty === 'number'
              ? Math.max(0, Math.floor(input.promoQty))
              : previousEntry?.promoQty ?? 0,
          ...(input.notes !== undefined
            ? input.notes.trim()
              ? { notes: input.notes }
              : {}
            : previousEntry?.notes
              ? { notes: previousEntry.notes }
              : {}),
        }
        // Match sidecar semantics: an explicit `unverified` honours the
        // caller; the absence of `unverified` means "manual edit, clear it."
        if (explicitUnverified) {
          if (input.unverified) next.unverified = true
        }
        const newGameMap = { ...gameMap }
        if (next.qty === 0 && next.promoQty === 0 && !next.notes) {
          delete newGameMap[cardId]
        } else {
          newGameMap[cardId] = next
        }
        return { ...s, collection: { ...s.collection, [gameId]: newGameMap } }
      })

      try {
        await apiSetCollectionEntry(gameId, cardId, input)
      } catch (err: unknown) {
        // Roll back on failure.
        setState((s) => {
          const gameMap = s.collection[gameId] ?? {}
          const newGameMap = { ...gameMap }
          if (previousEntry === undefined) delete newGameMap[cardId]
          else newGameMap[cardId] = previousEntry
          return { ...s, collection: { ...s.collection, [gameId]: newGameMap } }
        })
        setError(err instanceof Error ? err.message : String(err))
        throw err
      }
    },
    []
  )

  const createDeck = React.useCallback(async (input: CreateDeckInput): Promise<Deck> => {
    const deck = await apiCreateDeck(input)
    setState((s) => ({ ...s, decks: [...s.decks.filter((d) => d.id !== deck.id), deck] }))
    return deck
  }, [])

  const patchDeck = React.useCallback(
    async (gameId: string, deckId: string, input: PatchDeckInput): Promise<Deck> => {
      const deck = await apiPatchDeck(gameId, deckId, input)
      setState((s) => ({
        ...s,
        decks: s.decks.map((d) => (d.id === deck.id ? deck : d)),
      }))
      return deck
    },
    []
  )

  const deleteDeck = React.useCallback(async (gameId: string, deckId: string): Promise<void> => {
    await apiDeleteDeck(gameId, deckId)
    setState((s) => ({ ...s, decks: s.decks.filter((d) => d.id !== deckId) }))
  }, [])

  const value: SidecarStateValue = React.useMemo(
    () => ({
      state,
      loading,
      error,
      refresh,
      readOnly: READ_ONLY,
      setCollectionEntry,
      createDeck,
      patchDeck,
      deleteDeck,
    }),
    [state, loading, error, refresh, setCollectionEntry, createDeck, patchDeck, deleteDeck]
  )

  return (
    <SidecarStateContext.Provider value={value}>
      {children}
    </SidecarStateContext.Provider>
  )
}

export function useSidecarState(): SidecarStateValue {
  return React.useContext(SidecarStateContext)
}

/** Convenience selector for the collection map of one game. */
export function useGameCollection(gameId: string): Record<string, CollectionEntry> {
  const { state } = useSidecarState()
  return state.collection[gameId] ?? {}
}

/** Decks belonging to one game. */
export function useGameDecks(gameId: string): Deck[] {
  const { state } = useSidecarState()
  return React.useMemo(() => state.decks.filter((d) => d.gameId === gameId), [state.decks, gameId])
}

/** Look up a single deck (current state). */
export function useDeck(gameId: string, deckId: string | undefined): Deck | undefined {
  const { state } = useSidecarState()
  return React.useMemo(
    () => (deckId ? state.decks.find((d) => d.gameId === gameId && d.id === deckId) : undefined),
    [state.decks, gameId, deckId]
  )
}
