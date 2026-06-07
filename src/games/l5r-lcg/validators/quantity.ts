import type { ValidationIssue } from '../../_types'
import { issue, type ParsedDeck, type L5RCard } from './types'

/**
 * Validates per-title copy limits across Dynasty + Conflict decks.
 *
 * Per RRG:
 *   - "No more than 3 copies of a single card by title can be included
 *     in any combination in a player's dynasty and conflict decks."
 *   - "If a card has the text 'Limit X per deck', no more than X copies
 *     of that card may be included." Encoded as `card.deckLimit: X`.
 *
 * Provinces are handled by deckShape (province-title uniqueness).
 * Stronghold/Role are singletons by deckShape too.
 */
const DEFAULT_LIMIT = 3
const SKIRMISH_LIMIT = 2

export function validateQuantity(parsed: ParsedDeck, formatId: string): ValidationIssue[] {
  const out: ValidationIssue[] = []
  const baseline = formatId === 'skirmish' ? SKIRMISH_LIMIT : DEFAULT_LIMIT

  // Aggregate quantities by card id (across Dynasty + Conflict).
  const totals = new Map<string, { card: L5RCard; total: number; zones: string[] }>()
  for (const e of [...parsed.dynasty, ...parsed.conflict]) {
    const row = totals.get(e.card.id) ?? { card: e.card, total: 0, zones: [] as string[] }
    row.total += e.qty
    if (!row.zones.includes(e.zoneId)) row.zones.push(e.zoneId)
    totals.set(e.card.id, row)
  }

  for (const { card, total, zones } of totals.values()) {
    const limit = card.deckLimit ?? baseline
    if (total > limit) {
      out.push(issue.error(
        'card-copy-limit',
        `${card.name}: ${total} copies included, limit is ${limit}` +
          (card.deckLimit !== undefined ? ' (printed "Limit X per deck")' : '') +
          '.',
        { cardIds: [card.id], details: { total, limit, zones } },
      ))
    }
  }

  return out
}
