import type { ValidationIssue } from '../../_types'
import { issue, type ParsedDeck, isInClanOrNeutral } from './types'

/**
 * Validates the splash budget: sum of off-clan conflict-card influence costs
 * cannot exceed the deck's influence pool.
 *
 * Per RRG: "A player's stronghold indicates the amount of influence that
 * player may spend during deckbuilding." Plus Role bonuses (Keeper +3,
 * Support +8) stack onto that pool.
 *
 * Only off-clan (non-primary, non-Neutral) Conflict cards consume
 * influence. Dynasty cards effectively can't be splashed because the scrape
 * shows they don't carry an `influence` cost field.
 *
 * Skirmish format uses a flat 6 influence regardless of stronghold (no
 * stronghold is in play). Implemented below for completeness even though
 * the surrounding format validators may not be wired up yet.
 */
const SKIRMISH_FLAT_POOL = 6

export function validateInfluence(parsed: ParsedDeck, formatId: string): ValidationIssue[] {
  const out: ValidationIssue[] = []
  const primaryClan = parsed.stronghold?.clan ?? null

  // Compute the pool.
  let pool: number
  if (formatId === 'skirmish') {
    pool = SKIRMISH_FLAT_POOL
  } else if (parsed.stronghold) {
    pool = (parsed.stronghold.influencePool ?? 0) + (parsed.role?.influenceBonus ?? 0)
  } else {
    // No stronghold, can't compute pool yet — deckShape will already error
    // on the missing stronghold; we silently skip here.
    return out
  }

  // Sum off-clan conflict spend.
  let spent = 0
  const offClanCards: Array<{ name: string; cardId: string; clan: string | null; cost: number; qty: number; subtotal: number }> = []
  for (const e of parsed.conflict) {
    if (isInClanOrNeutral(e.card, primaryClan)) continue
    const cost = e.card.influence
    if (cost == null) {
      // Off-clan card without an influence cost — should be impossible
      // (Dynasty cards don't go in Conflict, and Conflict cards have a cost).
      // Flag as a warning so the user knows the data shape is off.
      out.push(issue.warn(
        'influence-cost-missing',
        `${e.card.name} is off-clan in your Conflict deck but has no influence cost in the catalog. Can't price it.`,
        { cardIds: [e.card.id] },
      ))
      continue
    }
    const subtotal = cost * e.qty
    spent += subtotal
    offClanCards.push({
      name: e.card.name, cardId: e.card.id, clan: e.card.clan ?? null,
      cost, qty: e.qty, subtotal,
    })
  }

  if (spent > pool) {
    out.push(issue.error(
      'influence-over-budget',
      `Splash spends ${spent} influence but your pool is ${pool}.`,
      {
        details: {
          pool,
          spent,
          shortfall: spent - pool,
          stronghold: parsed.stronghold?.name,
          baseInfluence: parsed.stronghold?.influencePool,
          roleBonus: parsed.role?.influenceBonus ?? 0,
          offClanCards,
        },
      },
    ))
  }

  return out
}
