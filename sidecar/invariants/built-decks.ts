/**
 * Built-deck invariant.
 *
 *   Rule: every card in any built deck must be physically available — i.e.
 *   the user's collection contains at least the sum of qty across all
 *   built decks for that (gameId, cardId).
 *
 *   Triggers that must re-check:
 *     1. Toggling a deck's `built` flag to true.
 *     2. Editing the zones of a built deck (or any deck whose new state is
 *        built).
 *     3. Decrementing a collection count.
 *
 *   These are pure functions. Routes apply the proposed change to a
 *   shallow projection and pass that here.
 */

export interface DeckEntry { cardId: string; qty: number }
export interface BuildableDeck {
  id: string
  gameId: string
  name: string
  built: boolean
  zones: Record<string, DeckEntry[]>
}

export interface CollectionMap {
  // per gameId, per cardId -> qty
  [gameId: string]: { [cardId: string]: { qty: number; promoQty?: number } }
}

export interface CardConflict {
  gameId: string
  cardId: string
  demanded: number  // sum from built decks
  owned: number     // collection qty for this card
  shortfall: number // demanded - owned (always > 0)
  // Each entry: a built deck that claims some of this card, with how many.
  claimedBy: Array<{ deckId: string; deckName: string; qty: number }>
}

export interface InvariantResult {
  ok: boolean
  conflicts: CardConflict[]
}

/**
 * Full-state check: given the proposed set of decks AND the proposed
 * collection, return any cards over-claimed by built decks.
 */
export function checkBuiltInvariant(
  decks: BuildableDeck[],
  collection: CollectionMap
): InvariantResult {
  // Build per (gameId, cardId) demand from built decks.
  const demand = new Map<string, Map<string, { qty: number; claimedBy: { deckId: string; deckName: string; qty: number }[] }>>()
  for (const deck of decks) {
    if (!deck.built) continue
    let gameMap = demand.get(deck.gameId)
    if (!gameMap) {
      gameMap = new Map()
      demand.set(deck.gameId, gameMap)
    }
    // Aggregate this deck's per-card qty (across zones).
    const perCard = new Map<string, number>()
    for (const entries of Object.values(deck.zones)) {
      for (const e of entries) {
        perCard.set(e.cardId, (perCard.get(e.cardId) ?? 0) + e.qty)
      }
    }
    for (const [cardId, qty] of perCard) {
      let row = gameMap.get(cardId)
      if (!row) {
        row = { qty: 0, claimedBy: [] }
        gameMap.set(cardId, row)
      }
      row.qty += qty
      row.claimedBy.push({ deckId: deck.id, deckName: deck.name, qty })
    }
  }

  const conflicts: CardConflict[] = []
  for (const [gameId, gameMap] of demand) {
    const coll = collection[gameId] ?? {}
    for (const [cardId, row] of gameMap) {
      const owned = coll[cardId]?.qty ?? 0
      if (row.qty > owned) {
        conflicts.push({
          gameId,
          cardId,
          demanded: row.qty,
          owned,
          shortfall: row.qty - owned,
          claimedBy: row.claimedBy,
        })
      }
    }
  }
  return { ok: conflicts.length === 0, conflicts }
}

/**
 * Convenience: project the current deck list with one replacement /
 * insertion, then run the full check. Used by the deck routes.
 */
export function checkWithDeckReplaced(
  allDecks: BuildableDeck[],
  replacement: BuildableDeck,
  collection: CollectionMap
): InvariantResult {
  const others = allDecks.filter((d) => d.id !== replacement.id)
  return checkBuiltInvariant([...others, replacement], collection)
}

/**
 * Convenience: project the current collection with one card's qty replaced,
 * then run the full check. Used by the collection route.
 *
 * Cheaper specialised path: only the affected card can violate, so we just
 * look at that one cell.
 */
export function checkWithCollectionReplaced(
  decks: BuildableDeck[],
  gameId: string,
  cardId: string,
  newQty: number
): InvariantResult {
  let demanded = 0
  const claimedBy: { deckId: string; deckName: string; qty: number }[] = []
  for (const deck of decks) {
    if (!deck.built || deck.gameId !== gameId) continue
    let here = 0
    for (const entries of Object.values(deck.zones)) {
      for (const e of entries) {
        if (e.cardId === cardId) here += e.qty
      }
    }
    if (here > 0) {
      demanded += here
      claimedBy.push({ deckId: deck.id, deckName: deck.name, qty: here })
    }
  }
  if (demanded > newQty) {
    return {
      ok: false,
      conflicts: [{
        gameId,
        cardId,
        demanded,
        owned: newQty,
        shortfall: demanded - newQty,
        claimedBy,
      }],
    }
  }
  return { ok: true, conflicts: [] }
}
