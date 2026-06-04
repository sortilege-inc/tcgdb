// Validation checks driving the landing-page dashboard.
//
// Each check is a small pure function returning a typed result. Checks are
// grouped into three buckets so a regression in any one is visible without
// drilling: site/framework (plumbing), implementation (shipped features),
// rules enforcement (data + L5R deck rules).
//
// Adding a new check is a one-liner: append to the relevant group's runner.

import type { Card, Deck, MutableState } from '../types/data'
import { getGameModule } from '../games/registry'
import { getGame } from '../data/games'
import {
  hasTrigger, getRoleRestriction, hasKeyword, matchesFilters,
  DEFAULT_FILTERS,
  type FilterableCard,
} from '../components/CardFilterPanel'
import { FEATURE_CHECKLIST, type FeatureStatus } from './feature-checklist'

// =============================================================================
// Types
// =============================================================================

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'pending' | 'skip'

export interface CheckResult {
  id: string
  title: string
  status: CheckStatus
  /** One-line outcome line shown next to the title. */
  message?: string
  /** Optional expandable detail rows for failures and warnings. */
  details?: string[]
}

export interface CheckGroup {
  id: string
  title: string
  description?: string
  results: CheckResult[]
}

export interface ChecksContext {
  /** Whole-game card data fetched at build time via GraphQL. */
  cards: Card[]
  /** Card-set list for the active game. */
  sets: { setId: string; name: string }[]
  /** Sidecar state — null if unreachable / still loading. */
  sidecarState: MutableState | null
  /** Sidecar /api/health probe outcome — null while pending. */
  sidecarHealth: { ok: boolean; error?: string } | null
  /** Active game id ('l5r-lcg'). */
  gameId: string
}

// Helper: build a CheckResult quickly without repeating boilerplate.
function ok(id: string, title: string, message?: string): CheckResult {
  return { id, title, status: 'pass', message }
}
function fail(id: string, title: string, message: string, details?: string[]): CheckResult {
  return { id, title, status: 'fail', message, details }
}
function warn(id: string, title: string, message: string, details?: string[]): CheckResult {
  return { id, title, status: 'warn', message, details }
}
function skip(id: string, title: string, message: string): CheckResult {
  return { id, title, status: 'skip', message }
}
function pending(id: string, title: string, message?: string): CheckResult {
  return { id, title, status: 'pending', message }
}

// =============================================================================
// Group 1: Site & framework
// =============================================================================

export function runSiteFrameworkChecks(ctx: ChecksContext): CheckResult[] {
  const out: CheckResult[] = []

  // GraphQL card schema sourced the expected fields.
  {
    const sample = ctx.cards[0]
    if (!sample) {
      out.push(fail('schema-card-sample', 'GraphQL Card schema reachable',
        'No cards in dataset — cannot verify schema shape.'))
    } else {
      // Card.id (not cardId) is the canonical in-app field name. The GraphQL
      // node uses `cardId` because Gatsby reserves `id`, but adaptCards()
      // renames it back before the dashboard's checks ever see it.
      const required = ['id', 'gameId', 'setId', 'publisherId', 'name', 'type'] as const
      const missing = required.filter((k) => !(k in (sample as Record<string, unknown>)))
      out.push(missing.length === 0
        ? ok('schema-card-sample', 'GraphQL Card schema reachable',
          `Sample card has all 6 contract fields.`)
        : fail('schema-card-sample', 'GraphQL Card schema reachable',
          `Sample card missing ${missing.length} required field(s).`,
          missing))
    }
  }

  // Card data populated.
  out.push(ctx.cards.length > 0
    ? ok('card-data-sourced', 'Card data sourced',
      `${ctx.cards.length.toLocaleString()} card${ctx.cards.length === 1 ? '' : 's'} loaded for ${ctx.gameId}.`)
    : fail('card-data-sourced', 'Card data sourced',
      `Zero cards loaded for ${ctx.gameId}.`))

  // Card set data populated.
  out.push(ctx.sets.length > 0
    ? ok('set-data-sourced', 'Card-set data sourced',
      `${ctx.sets.length} set${ctx.sets.length === 1 ? '' : 's'} loaded.`)
    : fail('set-data-sourced', 'Card-set data sourced',
      'Zero sets loaded.'))

  // Game definition registered.
  {
    const game = getGame(ctx.gameId)
    out.push(game
      ? ok('game-registered', 'Game definition registered',
        `${game.shortName ?? game.name} (formats: ${game.formats.length}, zones: ${game.deckZones.length}).`)
      : fail('game-registered', 'Game definition registered',
        `getGame('${ctx.gameId}') returned undefined.`))
  }

  // Game module wired (validate / search / display schema present).
  {
    const module = getGameModule(ctx.gameId)
    if (!module) {
      out.push(fail('module-registered', 'Game module wired',
        `No module registered for '${ctx.gameId}'.`))
    } else {
      const missing: string[] = []
      if (typeof module.validate !== 'function') missing.push('validate')
      if (typeof module.deckSections !== 'function') missing.push('deckSections')
      if (typeof module.computeDeckStats !== 'function') missing.push('computeDeckStats')
      if (!Array.isArray(module.searchableFields)) missing.push('searchableFields')
      if (!Array.isArray(module.cardDisplaySchema)) missing.push('cardDisplaySchema')
      out.push(missing.length === 0
        ? ok('module-registered', 'Game module wired',
          'All required entry points present.')
        : fail('module-registered', 'Game module wired',
          `Missing ${missing.length} entry point(s).`, missing))
    }
  }

  // Sidecar /api/health.
  {
    const h = ctx.sidecarHealth
    if (h === null) {
      out.push(pending('sidecar-health', 'Sidecar reachable', 'Probing…'))
    } else if (h.ok) {
      out.push(ok('sidecar-health', 'Sidecar reachable', '/api/health returned 200.'))
    } else {
      out.push(fail('sidecar-health', 'Sidecar reachable',
        h.error ?? 'Probe failed.',
        [
          'Run `npm run develop:sidecar` (or `npm run sidecar`) in another terminal.',
          'Expected: http://localhost:8001/api/health → { ok: true }.',
        ]))
    }
  }

  // Sidecar state load — needed for deck CRUD, collection mutations.
  {
    if (ctx.sidecarHealth === null) {
      out.push(pending('sidecar-state', 'Sidecar state loaded'))
    } else if (!ctx.sidecarHealth.ok) {
      out.push(skip('sidecar-state', 'Sidecar state loaded',
        'Skipped — sidecar unreachable.'))
    } else if (!ctx.sidecarState) {
      out.push(fail('sidecar-state', 'Sidecar state loaded',
        'Sidecar is up but state is null.'))
    } else {
      const s = ctx.sidecarState
      const deckCount = s.decks.length
      const collectionEntries = Object.values(s.collection).reduce(
        (n, byGame) => n + Object.keys(byGame).length, 0)
      out.push(ok('sidecar-state', 'Sidecar state loaded',
        `${deckCount} deck${deckCount === 1 ? '' : 's'} · ${collectionEntries} collection entries.`))
    }
  }

  return out
}

// =============================================================================
// Group 2: Implementation checklist
// =============================================================================

export function runImplementationChecks(_ctx: ChecksContext): CheckResult[] {
  // Translate the static checklist into CheckResult shape. Each item's
  // optional `verify` runs a live sanity probe — if that throws or returns
  // false, we downgrade the entry to a fail/warn even if it was marked
  // "shipped".
  return FEATURE_CHECKLIST.map((item) => {
    const baseTitle = item.title
    let status: CheckStatus
    let message = item.notes ?? ''

    switch (item.status) {
      case 'shipped': status = 'pass'; break
      case 'partial': status = 'warn'; break
      case 'planned': status = 'skip'; message = message || 'Not yet started.'; break
    }

    if (item.verify && (item.status === 'shipped' || item.status === 'partial')) {
      try {
        const v = item.verify()
        if (!v.ok) {
          return fail(`feature.${item.id}`, baseTitle,
            v.message ?? 'Live verifier returned false.',
            v.details)
        }
        if (v.message) message = v.message
      } catch (err: unknown) {
        return fail(`feature.${item.id}`, baseTitle,
          `Verifier threw: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return { id: `feature.${item.id}`, title: baseTitle, status, message }
  })
}

// =============================================================================
// Group 3: Rules-enforcement validation
// =============================================================================

export function runRulesEnforcementChecks(ctx: ChecksContext): CheckResult[] {
  const out: CheckResult[] = []
  const cards = ctx.cards

  // 3.1 No duplicate cardIds.
  {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const c of cards) {
      if (seen.has(c.id)) dupes.push(c.id)
      seen.add(c.id)
    }
    out.push(dupes.length === 0
      ? ok('rules.unique-card-ids', 'Unique card IDs',
        `All ${cards.length.toLocaleString()} ids are unique.`)
      : fail('rules.unique-card-ids', 'Unique card IDs',
        `${dupes.length} duplicate id(s).`,
        dupes.slice(0, 20)))
  }

  // 3.2 Required-field coverage.
  {
    const issues: string[] = []
    for (const c of cards) {
      if (!c.name || !c.name.trim()) issues.push(`${c.id} — empty name`)
      if (!c.type || !c.type.trim()) issues.push(`${c.id} — empty type`)
      if (!c.setId || !c.setId.trim()) issues.push(`${c.id} — empty setId`)
    }
    out.push(issues.length === 0
      ? ok('rules.required-fields', 'Required card fields present',
        'Every card has name / type / setId.')
      : fail('rules.required-fields', 'Required card fields present',
        `${issues.length} card(s) missing one or more required fields.`,
        issues.slice(0, 20)))
  }

  // 3.3 Every card.setId resolves to a known CardSet.
  {
    const knownSets = new Set(ctx.sets.map((s) => s.setId))
    const orphans = new Set<string>()
    for (const c of cards) if (!knownSets.has(c.setId)) orphans.add(c.setId)
    out.push(orphans.size === 0
      ? ok('rules.set-resolution', 'Card setId → set resolution',
        `All cards reference known sets.`)
      : fail('rules.set-resolution', 'Card setId → set resolution',
        `${orphans.size} unknown setId(s) referenced.`,
        Array.from(orphans).slice(0, 20)))
  }

  // 3.4 flipSideOf is bidirectional and points to a real card.
  {
    const byId = new Map(cards.map((c) => [c.id, c] as const))
    const issues: string[] = []
    for (const c of cards) {
      if (!c.flipSideOf) continue
      const partner = byId.get(c.flipSideOf)
      if (!partner) {
        issues.push(`${c.id} → ${c.flipSideOf} (partner does not exist)`)
      } else if (partner.flipSideOf !== c.id) {
        issues.push(`${c.id} → ${c.flipSideOf}, but ${c.flipSideOf} → ${partner.flipSideOf ?? '(none)'}`)
      }
    }
    out.push(issues.length === 0
      ? ok('rules.flipside-bidirectional', 'flipSideOf is bidirectional',
        'Every flip-side links back to its partner.')
      : fail('rules.flipside-bidirectional', 'flipSideOf is bidirectional',
        `${issues.length} unidirectional or orphan link(s).`,
        issues.slice(0, 20)))
  }

  // 3.5 Every CardSet has at least one card.
  {
    const haveCards = new Set(cards.map((c) => c.setId))
    const empty = ctx.sets.filter((s) => !haveCards.has(s.setId))
    out.push(empty.length === 0
      ? ok('rules.sets-non-empty', 'All sets contain cards',
        `${ctx.sets.length} sets, all non-empty.`)
      : warn('rules.sets-non-empty', 'All sets contain cards',
        `${empty.length} set(s) have no cards.`,
        empty.map((s) => s.name).slice(0, 20)))
  }

  // 3.6 Filter-panel parser self-tests (regression bait). If these go red,
  //     the shared text-parsing helpers in CardFilterPanel drifted.
  {
    const t1 = hasTrigger('Action: Bow this character.', 'Action')
    const t2 = hasTrigger('Reaction: Honor a character.', 'Reaction')
    const t3 = hasTrigger('Forced Reaction: Discard.', 'Reaction')
    const t4 = hasTrigger('Forced Reaction: Discard.', 'Forced Reaction')
    const r1 = getRoleRestriction('Earth role only. Foo.')
    const r2 = getRoleRestriction('Foo bar.')
    const k1 = hasKeyword('Pride. Action: ...', 'Pride')
    const k2 = hasKeyword('There is pride in this clan.', 'Pride')

    const fails: string[] = []
    if (!t1) fails.push('hasTrigger("Action: …", "Action") should be true')
    if (!t2) fails.push('hasTrigger("Reaction: …", "Reaction") should be true')
    if (t3) fails.push('hasTrigger("Forced Reaction: …", "Reaction") should be FALSE (false-positive guard)')
    if (!t4) fails.push('hasTrigger("Forced Reaction: …", "Forced Reaction") should be true')
    if (r1 !== 'earth') fails.push(`getRoleRestriction("Earth role only.") should be "earth", got ${r1}`)
    if (r2 !== null) fails.push(`getRoleRestriction("Foo bar.") should be null, got ${r2}`)
    if (!k1) fails.push('hasKeyword("Pride. Action: …", "Pride") should be true')
    if (k2) fails.push('hasKeyword("There is pride…", "Pride") should be FALSE (no leading word boundary + period)')
    out.push(fails.length === 0
      ? ok('rules.filter-parsers', 'Filter-panel text parsers',
        '8/8 parser self-tests pass.')
      : fail('rules.filter-parsers', 'Filter-panel text parsers',
        `${fails.length}/8 self-test(s) failed.`, fails))
  }

  // 3.7 matchesFilters smoke test on a synthetic card.
  {
    const synth: FilterableCard = {
      cardId: 'syn', name: 'Test', type: 'Character', clan: 'Crab',
      unique: true, traits: ['Bushi'], text: 'Action: Test.',
    }
    const m1 = matchesFilters(synth, DEFAULT_FILTERS) === true
    const m2 = matchesFilters(synth, { ...DEFAULT_FILTERS, clans: new Set(['Crane']) }) === false
    const m3 = matchesFilters(synth, { ...DEFAULT_FILTERS, triggeredAbility: 'Action' }) === true
    const fails: string[] = []
    if (!m1) fails.push('Default filter should accept any card')
    if (!m2) fails.push('Clan=Crane filter should reject Crab card')
    if (!m3) fails.push('triggeredAbility=Action should match a card with "Action:" text')
    out.push(fails.length === 0
      ? ok('rules.matches-filters', 'matchesFilters smoke test',
        '3/3 synthetic cases pass.')
      : fail('rules.matches-filters', 'matchesFilters smoke test',
        `${fails.length}/3 failed.`, fails))
  }

  // 3.8 Saved decks validate against the L5R game module rules.
  if (ctx.sidecarState) {
    const module = getGameModule(ctx.gameId)
    const game = getGame(ctx.gameId)
    if (!module || !game) {
      out.push(skip('rules.deck-validation', 'Saved decks validate',
        'Skipped — no game module / definition.'))
    } else {
      const byId = new Map<string, Card>(cards.map((c) => [c.id, c] as const))
      const lookup = {
        get: (id: string) => byId.get(id),
        getMany: (ids: string[]) => ids.map((id) => byId.get(id)).filter((c): c is Card => !!c),
      }
      const myDecks: Deck[] = ctx.sidecarState.decks.filter((d) => d.gameId === ctx.gameId)
      let errCount = 0
      let warnCount = 0
      const issues: string[] = []
      for (const d of myDecks) {
        const fmt = game.formats.find((f) => f.id === d.formatId) ?? { id: d.formatId, name: d.formatId }
        const result = module.validate({ deck: d, format: fmt, lookup })
        for (const e of result.errors) {
          errCount++
          issues.push(`✗ [${d.name}] ${e.message}`)
        }
        for (const w of result.warnings) {
          warnCount++
          issues.push(`◦ [${d.name}] ${w.message}`)
        }
      }
      if (myDecks.length === 0) {
        out.push(skip('rules.deck-validation', 'Saved decks validate',
          'No saved decks yet.'))
      } else if (errCount === 0 && warnCount === 0) {
        out.push(ok('rules.deck-validation', 'Saved decks validate',
          `${myDecks.length} deck${myDecks.length === 1 ? '' : 's'} validate clean.`))
      } else if (errCount === 0) {
        out.push(warn('rules.deck-validation', 'Saved decks validate',
          `${warnCount} warning${warnCount === 1 ? '' : 's'} across ${myDecks.length} deck${myDecks.length === 1 ? '' : 's'}.`,
          issues.slice(0, 30)))
      } else {
        out.push(fail('rules.deck-validation', 'Saved decks validate',
          `${errCount} error${errCount === 1 ? '' : 's'} (+ ${warnCount} warning${warnCount === 1 ? '' : 's'}) across ${myDecks.length} deck${myDecks.length === 1 ? '' : 's'}.`,
          issues.slice(0, 30)))
      }
    }
  } else {
    out.push(pending('rules.deck-validation', 'Saved decks validate'))
  }

  // 3.9 Saved decks reference real cards.
  if (ctx.sidecarState) {
    const known = new Set(cards.map((c) => c.id))
    const issues: string[] = []
    for (const d of ctx.sidecarState.decks.filter((d) => d.gameId === ctx.gameId)) {
      for (const [zoneId, entries] of Object.entries(d.zones)) {
        for (const e of entries) {
          if (!known.has(e.cardId)) {
            issues.push(`[${d.name}] zone "${zoneId}" — unknown cardId ${e.cardId}`)
          }
        }
      }
    }
    out.push(issues.length === 0
      ? ok('rules.deck-cards-resolve', 'Deck cards resolve',
        'Every deck entry references a known card.')
      : fail('rules.deck-cards-resolve', 'Deck cards resolve',
        `${issues.length} orphan deck entr${issues.length === 1 ? 'y' : 'ies'}.`,
        issues.slice(0, 20)))
  }

  return out
}

// =============================================================================
// Orchestrator
// =============================================================================

export function runAllChecks(ctx: ChecksContext): CheckGroup[] {
  return [
    {
      id: 'site-framework',
      title: 'Site & framework',
      description:
        'GraphQL schema, data sourcing, game module registration, sidecar reachability. ' +
        'A regression here usually means the project won’t build or the sidecar isn’t running.',
      results: runSiteFrameworkChecks(ctx),
    },
    {
      id: 'implementation',
      title: 'Implementation checklist',
      description:
        'Which user-facing features are shipped, partial, or planned. The shipped entries run a ' +
        'live verifier where possible so regressions in the underlying components show up red here.',
      results: runImplementationChecks(ctx),
    },
    {
      id: 'rules-enforcement',
      title: 'Rules & data enforcement',
      description:
        'Schema-level guarantees about the card / set / deck data — duplicate ids, orphan refs, ' +
        'flip-side pairings, parser self-tests, and every saved deck running through the L5R ' +
        'game module’s validate(). Goes red when the data layer drifts.',
      results: runRulesEnforcementChecks(ctx),
    },
  ]
}

export type { FeatureStatus }
