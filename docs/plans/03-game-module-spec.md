# 03 — Per-Game Code Module Specification

Each game ships a module at `src/games/<gameId>/index.ts` that implements the
`GameModule` interface. The module is the home for everything that is
*specific to that game* but doesn't belong in static data — primarily rules,
display hints, and import parsers.

## The `GameModule` interface

```ts
import type { Card, Deck, Format, CardSet, CollectionEntry } from '../_types/data'

export interface GameModule {
  // Identity ---------------------------------------------------------------

  gameId: string

  // Deck validation --------------------------------------------------------

  /**
   * Validate a deck against a format. Returns structured errors so the UI
   * can surface them with offending zone / card detail.
   */
  validate(input: ValidateInput): ValidationResult

  // Search & filtering -----------------------------------------------------

  /** Fields the user can search/filter on in this game's card browser. */
  searchableFields: SearchFieldSpec[]

  /** A predicate factory that turns a parsed search query into a filter. */
  buildSearchPredicate(query: SearchQuery): (card: Card) => boolean

  // Display ----------------------------------------------------------------

  /**
   * Group a deck's cards into sections for display (e.g. "Asset (13)" /
   * "ICE (16)" for Netrunner).
   */
  deckSections(deck: Deck, lookup: CardLookup): DeckSection[]

  /**
   * Pull the "leader/identity/hero/commander" card out for prominent
   * display, if the game has such a concept. Returns null otherwise.
   */
  primaryCard(deck: Deck, lookup: CardLookup): { zoneId: string; cardId: string } | null

  /** Top-level stats shown on a deck page (influence, honor, MV, etc). */
  computeDeckStats(deck: Deck, format: Format, lookup: CardLookup): DeckStat[]

  /** Field render order/grouping for the card detail page. */
  cardDisplaySchema: CardDisplayField[]

  // Collection -------------------------------------------------------------

  /**
   * Per-box expected-copy rule. Given a card and the set it's in, returns the
   * number of copies expected per box of that set.
   */
  expectedCopiesPerBox(card: Card, set: CardSet): number

  // Importers (optional) ---------------------------------------------------

  importers?: DeckImporter[]
}
```

## Supporting types

```ts
export interface ValidateInput {
  deck: Deck
  format: Format
  lookup: CardLookup                  // resolve cardId -> Card (effective, errata-aware)
  ownedCounts?: Record<string, number>// optional; for "can this deck be built?" checks
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]           // blocking
  warnings: ValidationIssue[]         // non-blocking
}

export interface ValidationIssue {
  rule: string                        // stable code, e.g. "deck-size-min"
  message: string                     // human-readable
  zoneId?: string
  cardIds?: string[]
  details?: Record<string, unknown>
}

export interface SearchFieldSpec {
  key: string                         // card field name
  label: string
  type: 'string' | 'number' | 'enum' | 'boolean' | 'set'
  enumValues?: string[]               // for type=enum/set
  operators?: SearchOperator[]
}

export type SearchOperator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
                            | 'contains' | 'startsWith' | 'in' | 'notIn'

export interface SearchQuery {
  terms: SearchTerm[]
  freeText?: string
}

export interface SearchTerm {
  field: string
  op: SearchOperator
  value: unknown
}

export interface DeckSection {
  title: string                       // e.g. "Asset (13)"
  cardEntries: { cardId: string; qty: number }[]
}

export interface DeckStat {
  key: string                         // e.g. "influence-spent"
  label: string                       // "Influence"
  value: string | number              // display-ready
  warning?: boolean                   // surface a warning style
}

export interface CardDisplayField {
  key: string                         // field name on the card
  label: string                       // display label
  format?: 'text' | 'cost' | 'faction' | 'influencePips' | 'icons' | 'html'
  hideIfEmpty?: boolean
}

export interface DeckImporter {
  id: string                          // "nrdb-json", "moxfield-text", "mtg-arena"
  label: string
  acceptsText: boolean
  acceptsUrl: boolean
  parse(input: string): Promise<Deck>
}

export interface CardLookup {
  get(cardId: string): Card | undefined
  getMany(ids: string[]): Card[]
}
```

## Stub module

Every game in the launch list must have a working module immediately, even if
unimplemented. Stubs use the shared `makeStubModule(gameId)` helper from
`src/games/stub.ts`:

```ts
export function makeStubModule(gameId: string): GameModule {
  return {
    gameId,
    validate: () => ({
      valid: true,
      errors: [],
      warnings: [{
        rule: 'unimplemented',
        message: `Deck validation for ${gameId} is not yet implemented.`,
      }],
    }),
    searchableFields: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'type', label: 'Type', type: 'string' },
    ],
    buildSearchPredicate: (q) => (card) => {
      if (!q.freeText) return true
      return card.name.toLowerCase().includes(q.freeText.toLowerCase())
    },
    deckSections: (deck, lookup) => groupByType(deck, lookup),
    primaryCard: () => null,
    computeDeckStats: () => [],
    cardDisplaySchema: [
      { key: 'name', label: 'Name', format: 'text' },
      { key: 'type', label: 'Type', format: 'text' },
      { key: 'text', label: 'Text', format: 'text', hideIfEmpty: true },
    ],
    expectedCopiesPerBox: () => 3,    // sane default
  }
}
```

The runtime composes the eight per-game modules via a registry:

```ts
// src/games/registry.ts
import { l5rModule } from './l5r-lcg'
import { netrunnerModule } from './netrunner'
import { makeStubModule } from './stub'
// ...

export const GAME_MODULES: Record<string, GameModule> = {
  'l5r-lcg':         l5rModule         ?? makeStubModule('l5r-lcg'),
  'netrunner':       netrunnerModule   ?? makeStubModule('netrunner'),
  'arkham-lcg':      makeStubModule('arkham-lcg'),
  'vampire-rivals':  makeStubModule('vampire-rivals'),
  'vtes':            makeStubModule('vtes'),
  'flesh-and-blood': makeStubModule('flesh-and-blood'),
  'lotr-lcg':        makeStubModule('lotr-lcg'),
  'mtg':             makeStubModule('mtg'),
}
```

(Stub assignment is gradually replaced by real module assignment as each game
gets implemented.)

## What the module owns vs. what data owns

| Concern | Lives in module (code) | Lives in data (JSON) |
|---|---|---|
| Format names, IDs | | ✓ |
| Format rule logic (deck size, faction limits, banlist application) | ✓ | |
| Banlist contents | partially (composition is code, list of banned IDs is data on the Format) | ✓ for the list itself |
| Card identity / fields | | ✓ |
| Game-specific stat computation | ✓ | |
| Search field declarations | ✓ | |
| Search predicate semantics | ✓ | |
| Deck zone definitions (names, display order) | | ✓ (on Game) |
| Expected-copies-per-box rule | ✓ | |
| Card display field order | ✓ | |
| Iconography asset paths | partially (mapping is code) | ✓ for the asset files |

The principle: anything that's a *list of values* lives in data. Anything that
*interprets* those values lives in code.

## Open question: shared validators

Common patterns — deck size min/max, faction-influence math, banlist
application — could be factored into a `src/games/_lib/validators.ts` so each
module composes them. The exact shape of that library is deferred to the
phase where the second game is implemented (Phase 10 in
[04-features-and-phases.md](04-features-and-phases.md)) — premature
factoring before two real implementations exist tends to fit neither.
