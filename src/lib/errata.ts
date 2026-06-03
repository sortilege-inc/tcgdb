import type { Card } from '../types/data'

/**
 * Compute the effective card for legality / display, given a deck's
 * `enforceErrata` setting. Pure function — never mutates the input.
 */
export function effectiveCard<T extends Partial<Card> & Record<string, unknown>>(
  card: T,
  enforceErrata: boolean
): T {
  if (!enforceErrata) return card
  const errata = card.errata as Partial<Card> | undefined
  if (!errata) return card
  return { ...card, ...errata } as T
}

/** Fields that should never be overridden by errata, regardless of input. */
export const NON_OVERRIDABLE_CARD_FIELDS = new Set<string>([
  'id', 'cardId', 'gameId', 'setId', 'publisherId', 'errata', 'rulings',
])

/**
 * Return a list of (field, before, after) tuples for the errata changes,
 * suitable for the card-detail UI's diff view. Skips fields that aren't
 * meant to be overridden.
 */
export function erratafDiff(
  card: Partial<Card> & Record<string, unknown>
): Array<{ field: string; before: unknown; after: unknown }> {
  const errata = card.errata as Record<string, unknown> | undefined
  if (!errata) return []
  const out: Array<{ field: string; before: unknown; after: unknown }> = []
  for (const [field, after] of Object.entries(errata)) {
    if (NON_OVERRIDABLE_CARD_FIELDS.has(field)) continue
    const before = (card as Record<string, unknown>)[field]
    out.push({ field, before, after })
  }
  return out
}
