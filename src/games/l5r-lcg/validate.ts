/**
 * Composite L5R deck validator.
 *
 * Composes the per-concern validators in src/games/l5r-lcg/validators/ into
 * a single ValidationResult that the GameModule surfaces to the UI and the
 * sidecar.
 *
 * The errors-vs-warnings split:
 *   - errors  — the deck is illegal in the selected format.
 *   - warnings — the deck is legal but the user might want to know about
 *                something (e.g. unrecognized entries, errata applicable).
 */
import type { ValidateInput, ValidationResult, ValidationIssue } from '../_types'
import { parseDeck } from './validators/types'
import { validateDeckShape } from './validators/deckShape'
import { validateQuantity } from './validators/quantity'
import { validateClanLines } from './validators/clanLines'
import { validateProvinceElements } from './validators/provinces'
import { validateInfluence } from './validators/influence'
import { validateLegality } from './validators/legality'
import { validateRoleRestrictions } from './validators/roleRestrictions'

export function validateL5RDeck(input: ValidateInput): ValidationResult {
  const { deck, format, lookup } = input
  const formatId = format.id
  const parsed = parseDeck(deck, lookup)

  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  // Shape: stronghold/role/provinces/deck-size counts. Any unrecognized
  // entries surface here as a warning.
  for (const i of validateDeckShape(parsed, formatId)) {
    bucket(i, errors, warnings)
  }

  // Quantities: 3-copy rule + per-card `deckLimit` overrides.
  for (const i of validateQuantity(parsed, formatId)) {
    bucket(i, errors, warnings)
  }

  // Clan lines: in-clan/Neutral/splash boundaries; also pins down splash clan.
  const clanRes = validateClanLines(parsed, deck)
  for (const i of clanRes.issues) bucket(i, errors, warnings)

  // Provinces: element coverage with Seeker swap + dual-element provinces.
  for (const i of validateProvinceElements(parsed)) {
    bucket(i, errors, warnings)
  }

  // Influence: splash budget.
  for (const i of validateInfluence(parsed, formatId)) {
    bucket(i, errors, warnings)
  }

  // Per-format card legality (banned / restricted).
  for (const i of validateLegality(parsed, formatId)) {
    bucket(i, errors, warnings)
  }

  // Role-only restrictions on cards ("Air role only" etc.).
  for (const i of validateRoleRestrictions(parsed)) {
    bucket(i, errors, warnings)
  }

  // Surface errata state — the stub did this, preserve the behaviour.
  const erratedIds: string[] = []
  for (const zone of Object.values(deck.zones ?? {})) {
    for (const e of zone) {
      const card = lookup.get(e.cardId)
      if (card && (card as { errata?: unknown }).errata) erratedIds.push(e.cardId)
    }
  }
  if (erratedIds.length > 0) {
    warnings.push({
      rule: deck.enforceErrata ? 'errata-enforced' : 'errata-available',
      message: deck.enforceErrata
        ? `Errata enforced for ${erratedIds.length} card${erratedIds.length === 1 ? '' : 's'} in this deck. Effective text/stats reflect the revisions.`
        : `Errata available but NOT enforced for ${erratedIds.length} card${erratedIds.length === 1 ? '' : 's'}. Toggle "Enforce errata" to apply.`,
      cardIds: erratedIds,
    })
  }

  // Splash-clan informational warning (so the user can SEE what was inferred).
  if (clanRes.ctx.resolvedSplashClan && clanRes.ctx.splashSource === 'inferred') {
    warnings.push({
      rule: 'splash-inferred',
      message: `Splash clan inferred as ${clanRes.ctx.resolvedSplashClan} from your conflict deck. Set the deck's splashClan to lock it in.`,
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}

function bucket(
  i: ValidationIssue,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  // Soft heuristic: rules whose name starts with "errata-" or that surface
  // 'unrecognized-entries' are warnings; everything else from a validator is
  // an error. Validators may opt-in to warnings later by emitting a different
  // rule prefix.
  if (i.rule === 'unrecognized-entries' || i.rule.startsWith('errata-')) {
    warnings.push(i)
  } else {
    errors.push(i)
  }
}
