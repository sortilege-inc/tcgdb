import type { CollectionEntry, Deck } from '../types/data'

export interface DeckAvailability {
  totalNeeded: number
  availableNow: number       // ignoring other built decks
  availableFree: number      // after other built decks claim their cards
  reservedByBuilt: number    // availableNow - availableFree
  buildable: boolean         // availableFree >= totalNeeded
  // Per-card breakdown (only cards that contribute to a shortfall).
  shortfallCards: { cardId: string; needed: number; owned: number; reservedHere: number; freeHere: number }[]
}

export function computeDeckAvailability(
  deck: Deck,
  allDecks: readonly Deck[],
  collection: Record<string, CollectionEntry>
): DeckAvailability {
  const neededPerCard = new Map<string, number>()
  for (const entries of Object.values(deck.zones)) {
    for (const e of entries) {
      neededPerCard.set(e.cardId, (neededPerCard.get(e.cardId) ?? 0) + e.qty)
    }
  }

  const otherBuiltReserve = new Map<string, number>()
  for (const other of allDecks) {
    if (other.id === deck.id) continue
    if (!other.built) continue
    if (other.gameId !== deck.gameId) continue
    for (const entries of Object.values(other.zones)) {
      for (const e of entries) {
        otherBuiltReserve.set(e.cardId, (otherBuiltReserve.get(e.cardId) ?? 0) + e.qty)
      }
    }
  }

  let totalNeeded = 0
  let availableNow = 0
  let availableFree = 0
  const shortfallCards: DeckAvailability['shortfallCards'] = []

  for (const [cardId, needed] of neededPerCard) {
    totalNeeded += needed
    const owned = collection[cardId]?.qty ?? 0
    const reservedHere = otherBuiltReserve.get(cardId) ?? 0
    const freeHere = Math.max(0, owned - reservedHere)

    const nowContribution = Math.min(needed, owned)
    const freeContribution = Math.min(needed, freeHere)
    availableNow += nowContribution
    availableFree += freeContribution

    if (freeContribution < needed) {
      shortfallCards.push({ cardId, needed, owned, reservedHere, freeHere })
    }
  }

  return {
    totalNeeded,
    availableNow,
    availableFree,
    reservedByBuilt: availableNow - availableFree,
    buildable: availableFree >= totalNeeded,
    shortfallCards,
  }
}
