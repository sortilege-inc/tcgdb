import type { Deck } from '../../../types/data'
import type { ValidationIssue } from '../../_types'
import { issue, type ParsedDeck, type L5RCard, isInClanOrNeutral } from './types'

/**
 * Validates that every card in the deck belongs to a legal clan-line for
 * the deck's primary + splash clans.
 *
 * Per RRG:
 *   - Stronghold's printed clan = primary clan.
 *   - Dynasty deck cards must be in-clan or Neutral. (No splash for Dynasty.)
 *   - Conflict deck cards must be in-clan, Neutral, OR from the single
 *     splash clan.
 *   - Provinces must be in-clan or Neutral.
 *
 * Splash-clan sourcing:
 *   - Deck.splashClan if explicitly set by the user (or by a forcing role).
 *   - Otherwise: inferred from the conflict deck — every non-(in-clan-or-Neutral)
 *     conflict card defines the splash clan. If more than one different clan
 *     appears, that's an error ("only one splash clan ever").
 */
export interface ClanLineContext {
  primaryClan: string | null
  resolvedSplashClan: string | null
  splashSource: 'declared' | 'role-forced' | 'inferred' | 'none'
}

export function validateClanLines(
  parsed: ParsedDeck,
  deck: Deck,
): { issues: ValidationIssue[]; ctx: ClanLineContext } {
  const out: ValidationIssue[] = []
  const primaryClan = parsed.stronghold?.clan ?? null

  // Pin down the splash clan.
  let resolvedSplashClan: string | null = null
  let splashSource: ClanLineContext['splashSource'] = 'none'

  // A Support role forces the splash clan.
  if (parsed.role?.forcesSplashClan) {
    resolvedSplashClan = parsed.role.forcesSplashClan
    splashSource = 'role-forced'
    // If the deck explicitly declares a different splash, that's wrong.
    if (deck.splashClan && deck.splashClan !== parsed.role.forcesSplashClan) {
      out.push(issue.error(
        'splash-role-conflict',
        `Role "${parsed.role.name}" forces splash = ${parsed.role.forcesSplashClan}; deck declares splash = ${deck.splashClan}.`,
        { cardIds: [parsed.role.id] },
      ))
    }
  } else if (deck.splashClan) {
    resolvedSplashClan = deck.splashClan
    splashSource = 'declared'
  }

  // Inspect conflict cards for clans that aren't in-clan, Neutral, or splash.
  const offClanConflict = parsed.conflict.filter((e) =>
    !isInClanOrNeutral(e.card, primaryClan)
  )
  const conflictNonPrimaryClans = new Set<string>()
  for (const e of offClanConflict) {
    if (e.card.clan) conflictNonPrimaryClans.add(e.card.clan)
  }

  // If no splash is set yet but the conflict deck has off-clan cards,
  // infer the splash from those cards.
  if (resolvedSplashClan === null && conflictNonPrimaryClans.size > 0) {
    if (conflictNonPrimaryClans.size === 1) {
      resolvedSplashClan = [...conflictNonPrimaryClans][0] ?? null
      splashSource = 'inferred'
    } else {
      // Multiple off-clan clans appear; can't infer.
      out.push(issue.error(
        'splash-multi-clan',
        `Conflict deck contains cards from multiple non-primary clans (${[...conflictNonPrimaryClans].sort().join(', ')}); only one splash clan is allowed.`,
        { details: { clans: [...conflictNonPrimaryClans] } },
      ))
    }
  }

  // Walk each section and flag clan-line violations.

  // Dynasty: in-clan or Neutral only.
  for (const e of parsed.dynasty) {
    if (!isInClanOrNeutral(e.card, primaryClan)) {
      out.push(issue.error(
        'dynasty-off-clan',
        `${e.card.name} (${e.card.clan ?? 'no clan'}) cannot be in the Dynasty deck — Dynasty cards must be in-clan (${primaryClan ?? '?'}) or Neutral.`,
        { cardIds: [e.card.id], zoneId: 'dynasty' },
      ))
    }
  }

  // Provinces: in-clan or Neutral only.
  for (const p of parsed.provinces) {
    if (!isInClanOrNeutral(p, primaryClan)) {
      out.push(issue.error(
        'province-off-clan',
        `Province "${p.name}" (${p.clan ?? 'no clan'}) must be in-clan (${primaryClan ?? '?'}) or Neutral.`,
        { cardIds: [p.id] },
      ))
    }
  }

  // Conflict: in-clan, Neutral, OR splash.
  if (resolvedSplashClan !== null) {
    for (const e of offClanConflict) {
      if (e.card.clan !== resolvedSplashClan) {
        out.push(issue.error(
          'conflict-wrong-splash',
          `${e.card.name} (${e.card.clan ?? 'no clan'}) is in your Conflict deck but isn't your splash clan (${resolvedSplashClan}).`,
          { cardIds: [e.card.id], zoneId: 'conflict' },
        ))
      }
    }
  }

  return {
    issues: out,
    ctx: { primaryClan, resolvedSplashClan, splashSource },
  }
}
