# 01 — Architecture

## Stack

- **Gatsby** (React-based static site generator) — owns routing, page generation,
  and the build-time GraphQL layer.
- **TypeScript** — used throughout (`src/`, sidecar, per-game modules).
- **GraphQL** — Gatsby's build-time data layer. Used only for the
  read-only "definitional" data (games, publishers, cards, sets, errata,
  rulings). Not used for mutable state.
- **JSON files** — canonical, committed-to-repo data store. Both definitional
  and mutable state live as JSON.
- **Node/Express sidecar** — small local API that reads and writes the JSON
  files. The React layer talks to it for mutable state and mutations.

## Two runtime modes

The same codebase runs in two modes, differentiated by a build-time env flag
(`GATSBY_READ_ONLY=true|false`).

### Local / editable (primary)

- `gatsby develop` running on `localhost:8000`.
- Sidecar API running on `localhost:8001` (or chosen port).
- Mutation UI is enabled. React fetches state from the sidecar, mutations POST
  to it, sidecar writes JSON files atomically.
- If a definitional JSON file changes (cards, sets, etc), Gatsby's filesystem
  watcher rebuilds the GraphQL layer. Mutable-state changes do not require a
  rebuild — React refetches on demand.

### Deployed / read-only

- `gatsby build` produces a static bundle.
- All mutable state is snapshotted at build time and inlined into the bundle
  (or shipped as a static JSON next to the HTML).
- Mutation UI is hidden / disabled. There is no sidecar; React reads state from
  the static snapshot.
- The deployed site is for viewing the collection from other devices.

A small set of components (mutation buttons, "save deck", "record price")
check `process.env.GATSBY_READ_ONLY` and render a disabled / hidden state when
true.

## Directory layout

```
tcgdb/
├── data/                              # Canonical JSON, committed
│   ├── games.json                     # All game records
│   ├── publishers.json                # All publisher records
│   ├── sets/
│   │   └── <gameId>/<setId>.json
│   ├── cards/
│   │   └── <gameId>/<setId>.json      # One file per game+set
│   ├── collection/
│   │   └── <gameId>.json              # Per-game owned counts
│   ├── decks/
│   │   └── <gameId>/<deckId>.json     # One file per deck
│   ├── prices/
│   │   └── <gameId>.jsonl             # Append-only price log per game
│   ├── notes/
│   │   └── games-played.jsonl         # Append-only game log
│   ├── sell-lists/
│   │   └── <id>.json
│   └── wishlist.json
├── sidecar/                           # Local mutation API
│   ├── index.ts                       # Express app, route table
│   ├── routes/
│   ├── invariants/                    # Constraint enforcement (built-deck, etc)
│   └── io/                            # Atomic file IO helpers
├── src/
│   ├── games/                         # Per-game code modules
│   │   ├── _types.ts                  # The GameModule interface
│   │   ├── l5r-lcg/
│   │   ├── netrunner/
│   │   ├── arkham-lcg/
│   │   ├── vampire-rivals/
│   │   ├── vtes/
│   │   ├── flesh-and-blood/
│   │   ├── lotr-lcg/
│   │   ├── mtg/
│   │   └── stub.ts                    # Default no-op module
│   ├── components/                    # Shared UI components
│   ├── pages/                         # Gatsby routes
│   ├── lib/                           # Shared logic (filter, search, IO)
│   ├── state/                         # React state — sidecar client, cache
│   └── gatsby-node.ts                 # GraphQL schema, page generation
├── scripts/                           # One-off importers, scrapers
├── docs/
│   └── plans/                         # These plan files
└── unsorted/                          # Existing reference files
```

## Data flow

### Definitional data (build-time)

```
data/games.json
data/publishers.json
data/sets/**.json     ──►  gatsby-source-filesystem  ──►  GraphQL nodes
data/cards/**.json
```

Pages query GraphQL at build time to render card detail pages, set indexes,
etc. This data is effectively frozen between rebuilds.

### Mutable state (runtime)

```
React UI  ◄──►  /api/state         ◄──►  sidecar  ◄──►  data/collection/**.json
                /api/collection                          data/decks/**.json
                /api/decks                               data/prices/**.jsonl
                /api/decks/<id>/build                    data/notes/**.jsonl
                /api/prices                              data/wishlist.json
                /api/notes                               data/sell-lists/**.json
                /api/wishlist
                /api/sell-lists
```

In read-only mode, the same React components hit a pre-bundled static JSON
instead of the sidecar.

## Sidecar API surface (sketch)

- `GET /api/state` — full mutable-state snapshot for boot.
- `POST /api/collection/<gameId>/<cardId>` — set qty / promoQty.
- `POST /api/decks` — create.
- `PATCH /api/decks/<id>` — update (name, zones, format, errata toggle,
  publisher filter, etc).
- `DELETE /api/decks/<id>`.
- `POST /api/decks/<id>/build` — toggle built (subject to invariant).
- `POST /api/prices/<gameId>` — append one or more price entries.
- `POST /api/notes/games-played` — append a game log entry.
- `PATCH /api/notes/games-played/<id>` — edit a game log entry.
- `POST /api/wishlist` — add/remove.
- `POST /api/sell-lists` — create.
- `PATCH /api/sell-lists/<id>` — update.

All mutation endpoints return either `{ ok: true, state: <new partial> }` or
`{ ok: false, error: { code, message, details } }`. Constraint violations
surface as structured errors with details (offending decks / cards / etc).

## Constraint enforcement

### Built-deck invariant

A deck can only be `built: true` if:

1. No card in the deck appears in any other built deck.
2. For every card in the deck, the user's collection contains at least `qty`
   copies (across all decks claiming that card — but since (1) prevents any
   other built deck from claiming, this collapses to "collection has at least
   this deck's qty").

Triggers that re-check the invariant:

- **Toggling built on:** check both conditions.
- **Editing a built deck's contents:** check both conditions against the new
  contents.
- **Decrementing a collection count:** check that no built deck would become
  underwater.

Violations return a structured error listing offending (deckId, cardId)
pairs. The UI surfaces them with action options ("unbuild the conflicting
deck" / "cancel this change").

### Errata model

Each card may have an optional `errata` block — a partial Card override.

```ts
effectiveCard = deck.enforceErrata && card.errata
  ? { ...card, ...card.errata }
  : card
```

Errata can change any field, including fields that affect deck legality
(cost, faction, influence, restrictions). Legality checks always use the
effective card.

### Publisher / homebrew filter

Decks declare a `publisherFilter`:

- `'official-only'` — only cards whose publisher is `official` for this game.
- `'include-third-party'` — all cards regardless of status.
- `'custom'` — additionally specify `customPublisherAllowlist: string[]`.

Legality checks reject any card not allowed under the deck's filter.

## Read-only deploy: data inclusion

The deployed read-only snapshot includes **all** state — definitional and
mutable. No data is considered private. The build process serialises the
full `data/` tree into a static JSON bundle that ships with the static
site. Mutation UI is disabled at build time via `GATSBY_READ_ONLY=true`.

## Active game, routing, and theming

A single global concept — the **active game** — drives the UI's mode:
which `GameModule` is loaded (search, deckbuilding, display), which theme
is applied, and which game-scoped routes are highlighted in the nav.

### URL structure

```
/                                  Picker / overview — no active game
/games                             Game index
/games/<gameId>                    Game home: recent decks, set list, stats
/games/<gameId>/cards              Card browser (uses module's search)
/games/<gameId>/cards/<cardId>     Card detail
/games/<gameId>/sets               Set / product index
/games/<gameId>/sets/<setId>       Set detail with completeness view
/games/<gameId>/collection         Collection adjustment
/games/<gameId>/decks              Deck list (filterable: own / imported, built, format)
/games/<gameId>/decks/<deckId>     Deck detail

/wishlist                          Cross-game wishlist
/sell-lists                        Cross-game sell-list index
/sell-lists/<id>                   Sell list detail
/notes                             Cross-game game-played log
```

URLs encode the game so bookmarks and the browser back/forward stack work
naturally. Navigating to a `/games/<gameId>/...` URL also implicitly sets
the active game.

### Active-game state

An `ActiveGameProvider` React context exposes:

```ts
{
  activeGameId: string | null
  setActiveGame(gameId: string | null): void
  activeModule: GameModule | null
  activeTheme: GameTheme | null
}
```

The provider:

- Sets `activeGameId` from the current route when on a `/games/<gameId>/...`
  page.
- Falls back to a localStorage value (`tcgdb.activeGameId`) when on a
  cross-game or top-level page, so the theme and nav stay consistent with
  what the user was last looking at.
- Writes to localStorage every time `activeGameId` changes.

`activeModule` is looked up in `GAME_MODULES` (see
[03-game-module-spec.md](03-game-module-spec.md)). `activeTheme` reads
the `theme` field on the corresponding `Game` record (see
[02-data-model.md](02-data-model.md)).

### Game switcher

A persistent top-nav element (dropdown or popover button) lists all eight
games, indicates which is active, and navigates to that game's `/games/<id>`
home on selection. The switcher also offers a "no active game" option that
routes to `/`.

### Theming

Theme values from the active `Game.theme` are applied as CSS custom
properties on a root `<div>` that wraps the page layout. Components consume
them via standard CSS variables (`--theme-primary`, `--theme-surface`, etc).
A default theme is bundled for the no-game state and as a fallback.

Phase 0 ships only a placeholder theme spec (one accent colour per game).
Phase 9 elaborates each game's theme with full palettes, optional font
choices, and decorative assets.

### URL stability

URLs are a durable contract. Once v1 is declared (see
[04-features-and-phases.md](04-features-and-phases.md)), every URL the
site has ever produced must continue to resolve to a meaningful page —
either the same page, or a `301`/`302` redirect to its successor. The
build pipeline includes a redirect manifest (`data/redirects.json`)
consumed by Gatsby's `createRedirect`.

Rules baked in from Phase 0:

- **URLs use IDs, never volatile slugs.** Card names, deck names, set
  names can all be renamed; URL paths must not depend on them. If we
  ever surface canonical "ID + slug" URLs (e.g. for human readability),
  the canonical form must accept the bare ID as input and redirect to
  the slug form — so renames are non-breaking.
- **All entity IDs are stable identifiers.** Once a Game, Publisher,
  Set, Card, or Deck has a published ID, that ID is immutable. ID
  conventions (see [02-data-model.md](02-data-model.md)) are picked
  deliberately for this reason.
- **Route shape is part of the contract.** Restructuring
  `/games/<gameId>/cards/<cardId>` to e.g. `/cards/<gameId>/<cardId>`
  post-v1 requires a redirect from every old URL form to every new one.
  We don't restructure casually.
- **Query parameter keys are part of the contract.** `?q=`, `?set=`,
  `?page=`, `?format=`, etc. once published, can't be renamed. Adding
  new optional params is always safe; renaming or repurposing an
  existing param is not.
- **Pre-v1 is iteration time.** Until v1 is declared, URL changes are
  fair game and we don't carry redirects for them. The v1 declaration
  is the freeze point. After that, every URL change adds a redirect
  entry to the manifest.

The phase that declares v1 is currently Phase 8 (see
[04-features-and-phases.md](04-features-and-phases.md)); this is itself
revisitable up to the freeze.

## File IO discipline

The sidecar writes JSON via "write to temp file, then rename" to avoid
partial-write corruption. Append-only logs (prices, games-played) use JSONL
with an exclusive lock during append.

All mutating writes are followed by a touch of a sentinel file so Gatsby's
develop-mode watcher knows when something definitional changed. Mutable-state
writes do not touch that sentinel (no rebuild needed).
