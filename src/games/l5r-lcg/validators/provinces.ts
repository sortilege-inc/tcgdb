import type { ValidationIssue } from '../../_types'
import { issue, type ParsedDeck, provinceElements } from './types'

/**
 * Validates province element coverage.
 *
 * Per RRG: "For each element, that player must choose one province
 * associated with that element, such that all five elements are
 * represented among their set of provinces."
 *
 * Variants:
 *   - Default (no role / Keeper / Support): all 5 rings must be represented.
 *   - Seeker of [Ring]: the selected Ring may appear in 2 provinces; one
 *     other ring may be absent. (The player swaps one province for a 2nd
 *     of the selected element.)
 *   - Dual-element provinces count toward each of their elements.
 *   - Toshi Ranbo (elements = all five) is the wildcard, satisfying any
 *     coverage automatically.
 */
const ALL_RINGS = ['air', 'earth', 'fire', 'water', 'void'] as const
type Ring = typeof ALL_RINGS[number]

export function validateProvinceElements(parsed: ParsedDeck): ValidationIssue[] {
  const out: ValidationIssue[] = []
  if (parsed.provinces.length === 0) return out

  // Build the per-ring count across all 5 provinces.
  const counts: Record<Ring, number> = { air: 0, earth: 0, fire: 0, water: 0, void: 0 }
  for (const p of parsed.provinces) {
    for (const r of provinceElements(p)) {
      if (isRing(r)) counts[r]++
    }
  }

  // Determine whether the role lets a ring be missing / doubled.
  const seekerRing: Ring | null =
    parsed.role?.roleClassifier === 'seeker' && isRing(parsed.role.roleRing ?? '')
      ? (parsed.role.roleRing as Ring)
      : null

  const missing: Ring[] = []
  for (const r of ALL_RINGS) {
    if (counts[r] < 1) missing.push(r)
  }

  if (seekerRing === null) {
    // Default rule: every ring must appear at least once.
    if (missing.length > 0) {
      out.push(issue.error(
        'province-missing-elements',
        `Province set is missing ring${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. Each of the five elements must be represented.`,
        { details: { counts, missing } },
      ))
    }
  } else {
    // Seeker rule: selected ring must have count ≥ 2 (or 1 if a dual-element
    // province also covers another missing ring); exactly one other ring
    // may be absent. We model it simply: the seeker ring must be covered
    // AT LEAST twice (either by a duplicate or a dual-element province)
    // and at most one OTHER ring may be 0.
    if (counts[seekerRing] < 2) {
      out.push(issue.error(
        'seeker-ring-undercovered',
        `Seeker of ${cap(seekerRing)} requires the ${cap(seekerRing)} ring to be represented twice (a 2nd ${cap(seekerRing)} province or a dual-element province that includes ${cap(seekerRing)}). Current count: ${counts[seekerRing]}.`,
        { cardIds: parsed.role ? [parsed.role.id] : undefined, details: { counts, seekerRing } },
      ))
    }
    const missingNonSeeker = missing.filter((r) => r !== seekerRing)
    if (missingNonSeeker.length > 1) {
      out.push(issue.error(
        'seeker-multiple-missing',
        `With Seeker of ${cap(seekerRing)}, at most one non-${cap(seekerRing)} ring may be absent. Missing: ${missingNonSeeker.join(', ')}.`,
        { details: { counts, missingNonSeeker } },
      ))
    }
  }

  return out
}

function isRing(s: string): s is Ring {
  return (ALL_RINGS as readonly string[]).includes(s)
}
function cap(s: string): string { return s[0]!.toUpperCase() + s.slice(1) }
