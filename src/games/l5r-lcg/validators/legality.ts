import type { ValidationIssue } from '../../_types'
import { issue, type ParsedDeck, type L5RCard } from './types'

/**
 * Validates per-card legality in the chosen format.
 *
 * Card schema: `legalIn?.[formatId]` is one of:
 *   - 'legal' (or absent) — no restriction
 *   - 'restricted' — at most 1 copy across the deck (community convention)
 *   - 'banned' — must not appear
 *
 * Per RRG: "Any additional deckbuilding restrictions contained in the
 * separate Imperial Law document, based on the format being played, must
 * be followed." That doc is encoded into the `legalIn` field.
 */
const RESTRICTED_MAX = 1

export function validateLegality(parsed: ParsedDeck, formatId: string): ValidationIssue[] {
  const out: ValidationIssue[] = []
  if (formatId === 'skirmish') {
    // Skirmish hasn't been mapped to legalIn yet; revisit when wired up.
  }

  type FormatKey = 'standard' | 'stronghold' | 'skirmish'
  const fid = formatId as FormatKey

  // Aggregate every card-in-deck (stronghold + role + provinces + dynasty + conflict).
  const allEntries: Array<{ card: L5RCard; qty: number }> = []
  if (parsed.stronghold) allEntries.push({ card: parsed.stronghold, qty: 1 })
  if (parsed.role) allEntries.push({ card: parsed.role, qty: 1 })
  for (const p of parsed.provinces) allEntries.push({ card: p, qty: 1 })
  for (const e of parsed.dynasty) allEntries.push({ card: e.card, qty: e.qty })
  for (const e of parsed.conflict) allEntries.push({ card: e.card, qty: e.qty })

  // Aggregate per cardId so we can apply the restricted-count cap.
  const totals = new Map<string, { card: L5RCard; total: number }>()
  for (const { card, qty } of allEntries) {
    const row = totals.get(card.id) ?? { card, total: 0 }
    row.total += qty
    totals.set(card.id, row)
  }

  for (const { card, total } of totals.values()) {
    const state = card.legalIn?.[fid]
    if (state === 'banned') {
      out.push(issue.error(
        'banned-in-format',
        `${card.name} is banned in ${formatId} format.`,
        { cardIds: [card.id] },
      ))
    } else if (state === 'restricted' && total > RESTRICTED_MAX) {
      out.push(issue.error(
        'restricted-in-format',
        `${card.name} is restricted in ${formatId} (max ${RESTRICTED_MAX}); deck has ${total} copies.`,
        { cardIds: [card.id], details: { total, max: RESTRICTED_MAX } },
      ))
    }
  }

  return out
}
