import type { ValidationIssue } from '../../_types'
import { issue, type ParsedDeck } from './types'

/**
 * Validates the structural shape of an L5R deck.
 *
 * Per RRG (Standard / Stronghold formats):
 *   - exactly 1 Stronghold
 *   - exactly 1 Role
 *   - 40-45 Dynasty cards (sum of quantities)
 *   - 40-45 Conflict cards (sum of quantities)
 *   - exactly 5 Provinces (no two with same title — quantity check)
 *
 * For Skirmish: stronghold/role/provinces should be absent, 30-40 each
 * deck. Not yet implemented; this validator throws no skirmish-specific
 * issues but won't error out either.
 */
export function validateDeckShape(parsed: ParsedDeck, formatId: string): ValidationIssue[] {
  const out: ValidationIssue[] = []

  if (formatId === 'skirmish') {
    // Skirmish has a different shape; not yet validated.
    return out
  }

  // Stronghold (exactly 1).
  if (!parsed.stronghold) {
    out.push(issue.error('stronghold-required', 'A deck must include exactly 1 Stronghold.'))
  }

  // Role (exactly 1).
  if (!parsed.role) {
    out.push(issue.error('role-required', 'A deck must include exactly 1 Role.'))
  }

  // Provinces (exactly 5).
  if (parsed.provinces.length !== 5) {
    out.push(issue.error(
      'province-count',
      `A deck must include exactly 5 Provinces (this deck has ${parsed.provinces.length}).`,
      { cardIds: parsed.provinces.map((p) => p.id) },
    ))
  }

  // Province uniqueness (no two by title).
  const titleCounts = new Map<string, number>()
  for (const p of parsed.provinces) titleCounts.set(p.name, (titleCounts.get(p.name) ?? 0) + 1)
  const dupes = [...titleCounts.entries()].filter(([, n]) => n > 1)
  for (const [name, n] of dupes) {
    out.push(issue.error(
      'province-duplicate-title',
      `Province "${name}" appears ${n} times — at most one copy of any province by title is allowed.`,
    ))
  }

  // Dynasty: 40-45.
  const dynastyCount = parsed.dynasty.reduce((n, e) => n + e.qty, 0)
  if (dynastyCount < 40 || dynastyCount > 45) {
    out.push(issue.error(
      'dynasty-deck-size',
      `Dynasty deck must contain 40-45 cards (this deck has ${dynastyCount}).`,
      { zoneId: 'dynasty' },
    ))
  }

  // Conflict: 40-45.
  const conflictCount = parsed.conflict.reduce((n, e) => n + e.qty, 0)
  if (conflictCount < 40 || conflictCount > 45) {
    out.push(issue.error(
      'conflict-deck-size',
      `Conflict deck must contain 40-45 cards (this deck has ${conflictCount}).`,
      { zoneId: 'conflict' },
    ))
  }

  // Surface unrecognized entries as a single warning per affected zone.
  if (parsed.unrecognized.length > 0) {
    out.push(issue.warn(
      'unrecognized-entries',
      `${parsed.unrecognized.length} deck entr${parsed.unrecognized.length === 1 ? 'y' : 'ies'} could not be classified into a deck slot.`,
      { cardIds: parsed.unrecognized.map((u) => u.cardId), details: { entries: parsed.unrecognized } },
    ))
  }

  return out
}
