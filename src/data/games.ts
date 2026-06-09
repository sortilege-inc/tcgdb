import gamesData from '../../data/games.json'
import publishersData from '../../data/publishers.json'
import type { Game, Publisher, PublisherFilter, Card } from '../types/data'

export const GAMES: Game[] = gamesData as Game[]

const GAME_BY_ID: Record<string, Game> = Object.fromEntries(
  GAMES.map((g) => [g.id, g])
)

export function getGame(gameId: string): Game | undefined {
  return GAME_BY_ID[gameId]
}

// ────────────────────────────────────────────────────────────────────────
// Publishers
// ────────────────────────────────────────────────────────────────────────

export const PUBLISHERS: Publisher[] = publishersData as Publisher[]

const PUBLISHER_BY_ID: Record<string, Publisher> = Object.fromEntries(
  PUBLISHERS.map((p) => [p.id, p])
)

export function getPublisher(publisherId: string): Publisher | undefined {
  return PUBLISHER_BY_ID[publisherId]
}

/**
 * Display name for a publisher id. Falls back to the id if the publisher
 * isn't registered (which would indicate a data inconsistency).
 */
export function publisherName(publisherId: string): string {
  return PUBLISHER_BY_ID[publisherId]?.name ?? publisherId
}

/**
 * Returns the publishers active for a given game, in the order declared
 * on the Game record (official first by convention). Each entry pairs
 * the rich Publisher record with the per-game status ('official' vs
 * 'third-party').
 */
export function publishersForGame(gameId: string): Array<{
  publisher: Publisher
  status: 'official' | 'third-party'
  notes?: string
}> {
  const game = getGame(gameId)
  if (!game) return []
  const out: Array<{
    publisher: Publisher
    status: 'official' | 'third-party'
    notes?: string
  }> = []
  for (const gp of game.publishers) {
    const pub = getPublisher(gp.publisherId)
    if (!pub) continue   // unknown publisher id in games.json — skip
    out.push({ publisher: pub, status: gp.status, notes: gp.notes })
  }
  return out
}

// ────────────────────────────────────────────────────────────────────────
// Publisher filter matching
// ────────────────────────────────────────────────────────────────────────

/**
 * Does a card pass the deck's publisher filter? Used by the deck-build
 * UI to hide cards from non-selected publishers entirely.
 *
 * - undefined filter → all cards pass (legacy decks, decks created
 *   before this field was wired through).
 * - 'official-only' → only cards whose publisher is marked 'official'
 *   on the game record.
 * - 'include-third-party' → everything passes.
 * - 'custom' → card's publisherId must appear in allowedPublisherIds.
 */
export function matchesPublisherFilter(
  card: Pick<Card, 'publisherId'>,
  filter: PublisherFilter | undefined,
  gameId: string,
): boolean {
  if (!filter) return true
  switch (filter.mode) {
    case 'include-third-party':
      return true
    case 'official-only': {
      const game = getGame(gameId)
      if (!game) return true
      const officialIds = new Set(
        game.publishers.filter((p) => p.status === 'official').map((p) => p.publisherId)
      )
      return officialIds.has(card.publisherId)
    }
    case 'custom':
      return filter.allowedPublisherIds.includes(card.publisherId)
  }
}

/**
 * Normalize a multi-select of publisher IDs into a PublisherFilter.
 * If every publisher for the game is selected, returns
 * 'include-third-party' (cheaper match path); otherwise 'custom'.
 */
export function buildPublisherFilter(
  gameId: string,
  selectedIds: readonly string[],
): PublisherFilter {
  const allIds = publishersForGame(gameId).map((p) => p.publisher.id)
  const selectedSet = new Set(selectedIds)
  if (allIds.length > 0 && allIds.every((id) => selectedSet.has(id))) {
    return { mode: 'include-third-party' }
  }
  return { mode: 'custom', allowedPublisherIds: [...selectedIds] }
}

/**
 * Inverse — given a PublisherFilter and the game's full publisher
 * list, return which publisher IDs are currently selected. For the
 * 'official-only' mode this returns the publishers marked official;
 * 'include-third-party' returns the full set.
 */
export function extractSelectedPublishers(
  gameId: string,
  filter: PublisherFilter | undefined,
): string[] {
  const allIds = publishersForGame(gameId).map((p) => p.publisher.id)
  if (!filter) return allIds
  switch (filter.mode) {
    case 'include-third-party': return allIds
    case 'official-only': {
      const game = getGame(gameId)
      if (!game) return allIds
      return game.publishers.filter((p) => p.status === 'official').map((p) => p.publisherId)
    }
    case 'custom': return [...filter.allowedPublisherIds]
  }
}
