import type { ValidationIssue } from '../../_types'
import { issue, type ParsedDeck, type L5RCard } from './types'

/**
 * Validates per-card role restrictions.
 *
 * Per RRG: "Some cards have the text, '___ role only.' This is a
 * deckbuilding restriction, and is not active during gameplay."
 *
 * Encoded as Card.roleRestriction = { ring?, type?, clan? }. Each set field
 * must match the deck's Role card. If the deck has no role, every card
 * with a role restriction is illegal.
 */
export function validateRoleRestrictions(parsed: ParsedDeck): ValidationIssue[] {
  const out: ValidationIssue[] = []
  const role = parsed.role

  const allCards: L5RCard[] = []
  if (parsed.stronghold) allCards.push(parsed.stronghold)
  for (const p of parsed.provinces) allCards.push(p)
  for (const e of parsed.dynasty) allCards.push(e.card)
  for (const e of parsed.conflict) allCards.push(e.card)

  for (const c of allCards) {
    const r = c.roleRestriction
    if (!r) continue

    if (!role) {
      out.push(issue.error(
        'role-restriction-no-role',
        `${c.name} requires a specific role (${describeRestriction(r)}) but the deck has no Role card.`,
        { cardIds: [c.id] },
      ))
      continue
    }
    const mismatches: string[] = []
    if (r.ring && role.roleRing !== r.ring) mismatches.push(`ring=${r.ring} (role has ${role.roleRing ?? '?'})`)
    if (r.type && role.roleClassifier !== r.type) mismatches.push(`type=${r.type} (role is ${role.roleClassifier ?? '?'})`)
    if (r.clan && role.roleClan !== r.clan) mismatches.push(`clan=${r.clan} (role has ${role.roleClan ?? '?'})`)
    if (mismatches.length > 0) {
      out.push(issue.error(
        'role-restriction-mismatch',
        `${c.name} requires ${describeRestriction(r)}; deck Role "${role.name}" doesn't satisfy: ${mismatches.join('; ')}.`,
        { cardIds: [c.id, role.id] },
      ))
    }
  }

  return out
}

function describeRestriction(r: NonNullable<L5RCard['roleRestriction']>): string {
  const bits: string[] = []
  if (r.ring) bits.push(`${r.ring} role`)
  if (r.type) bits.push(`${r.type} role`)
  if (r.clan) bits.push(`${r.clan} role`)
  return bits.join(' / ')
}
