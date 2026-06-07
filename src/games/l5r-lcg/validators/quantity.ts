import type { ValidationIssue } from '../../_types'
import { issue, type ParsedDeck, type L5RCard } from './types'

/**
 * Validates per-title copy limits across Dynasty + Conflict decks.
 *
 * Per RRG p. 6 ("Copy (of a card)"):
 *   "A copy of a card is defined by title: any card that shares the same
 *    title is considered a copy, regardless of card type, text, deck of
 *    origin, artwork, or any other characteristic(s) of the card(s)."
 *
 * Per RRG p. 7 ("Deckbuilding") and p. 7 ("Deck Limits"):
 *   "No more than 3 copies of a single card by title can be included in
 *    any combination in a player's dynasty and conflict decks."
 *   "If a card has the text 'Limit X per deck', no more than X copies of
 *    that card may be included." Encoded as `card.deckLimit: X`.
 *
 * Aggregation is therefore keyed by **card.name**, not card.id — multiple
 * printings of the same card (e.g. Core Set Doji Hotaru and Justice for
 * Satsume Doji Hotaru) share one limit. When two printings disagree on
 * `deckLimit`, we take the lower value (the stricter constraint) so the
 * deck is legal under both printings' text.
 *
 * Provinces are handled by deckShape (province-title uniqueness).
 * Stronghold/Role are singletons by deckShape too.
 */
const DEFAULT_LIMIT = 3
const SKIRMISH_LIMIT = 2

export function validateQuantity(parsed: ParsedDeck, formatId: string): ValidationIssue[] {
  const out: ValidationIssue[] = []
  const baseline = formatId === 'skirmish' ? SKIRMISH_LIMIT : DEFAULT_LIMIT

  // Aggregate quantities by card NAME (across Dynasty + Conflict).
  interface Row {
    name: string
    total: number
    zones: string[]
    cardIds: string[]
    /** Strictest `deckLimit` across any printing that shares this title;
     *  undefined if no printing prints a "Limit X per deck" override. */
    deckLimit?: number
  }
  const totals = new Map<string, Row>()
  for (const e of [...parsed.dynasty, ...parsed.conflict]) {
    const key = e.card.name
    const row = totals.get(key) ?? { name: key, total: 0, zones: [], cardIds: [] }
    row.total += e.qty
    if (!row.zones.includes(e.zoneId)) row.zones.push(e.zoneId)
    if (!row.cardIds.includes(e.card.id)) row.cardIds.push(e.card.id)
    if (e.card.deckLimit !== undefined) {
      row.deckLimit = row.deckLimit === undefined
        ? e.card.deckLimit
        : Math.min(row.deckLimit, e.card.deckLimit)
    }
    totals.set(key, row)
  }

  for (const row of totals.values()) {
    const limit = row.deckLimit ?? baseline
    if (row.total > limit) {
      const printingsNote = row.cardIds.length > 1
        ? ` (combined across ${row.cardIds.length} printings)`
        : ''
      out.push(issue.error(
        'card-copy-limit',
        `${row.name}: ${row.total} copies included${printingsNote}, limit is ${limit}` +
          (row.deckLimit !== undefined ? ' (printed "Limit X per deck")' : '') +
          '.',
        {
          cardIds: row.cardIds,
          details: {
            total: row.total,
            limit,
            zones: row.zones,
            printings: row.cardIds,
          },
        },
      ))
    }
  }

  return out
}
