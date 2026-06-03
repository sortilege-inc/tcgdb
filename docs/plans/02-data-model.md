# 02 — Data Model

All entities are TypeScript-typed; their serialised form is JSON on disk. IDs
are string slugs unless noted.

## Game

```ts
interface Game {
  id: string                          // "l5r-lcg", "netrunner", "mtg"
  name: string                        // "Legend of the Five Rings LCG"
  shortName?: string                  // "L5R"
  status: 'stubbed' | 'partial' | 'complete'
  publishers: GamePublisher[]
  formats: Format[]
  deckZones: DeckZone[]
  iconRefs?: Record<string, string>   // logical name -> asset path
  theme: GameTheme                    // see below
}

interface GameTheme {
  primary: string                     // accent color, hex
  secondary?: string
  background?: string
  surface?: string
  text?: string
  accentMuted?: string
  font?: { body?: string; heading?: string }
  decorations?: Record<string, string>  // game-specific asset paths
                                        // (banners, borders, watermarks)
}

interface GamePublisher {
  publisherId: string
  status: 'official' | 'third-party'
  notes?: string                      // e.g. "FFG era, 2017-2021"
}

interface DeckZone {
  id: string                          // "dynasty", "conflict", "stronghold"
  name: string
  cardLimit?: { min?: number; max?: number }  // display hint only; rules in code
  description?: string
}
```

## Format

```ts
interface Format {
  id: string                          // "standard", "eternal", "commander"
  gameId: string
  name: string
  description?: string
  // No rule logic here; the per-game GameModule.validate(deck, formatId)
  // owns enforcement. This entry exists for display and dropdown menus.
}
```

## Publisher

```ts
interface Publisher {
  id: string                          // "ffg", "null-signal", "homebrew-jordan-l5r"
  name: string                        // "Fantasy Flight Games"
  url?: string
  notes?: string
}
```

Publishers are top-level. The official-vs-third-party distinction is per
*(game, publisher)* pair, expressed in `Game.publishers`. The same Publisher
record can be official for one game and third-party for another.

Homebrew sources get their own Publisher records (one per source, not one
umbrella) so they can be filtered individually.

## Set / Product

```ts
interface CardSet {
  id: string
  gameId: string
  publisherId: string
  name: string
  type: string                        // game-specific: "core", "expansion",
                                      // "pack", "cycle", "preview",
                                      // "homebrew", etc
  parentSetId?: string                // cycles → packs
  releaseDate?: string                // ISO; absent for unreleased
  status: 'released' | 'preview' | 'announced'
  cardCount?: number
  legalIn?: string[]                  // format IDs this set is part of
  notes?: string
}
```

## Card

The base Card shape carries fields common across all games. Game-specific
fields live alongside as flat top-level keys (typed per-game in the game
module). The Card persistence format is a discriminated record by `gameId`.

```ts
interface Card {
  id: string                          // game-scoped unique (e.g. "l5r:01-001")
  gameId: string
  setId: string
  publisherId: string
  name: string
  type: string                        // game-specific value
  unique?: boolean

  text?: string                       // as-written
  flavorText?: string
  illustrator?: string
  imagePath?: string                  // optional

  errata?: Partial<Card>              // override block; any field
  rulings?: Ruling[]

  // Game-specific fields live here as top-level keys, typed per game.
  // E.g. L5R: clan, cost, military, political, glory, influence, ...
  //      Netrunner: faction, side, cost, strength, influenceCost, ...
  [gameField: string]: unknown
}

interface Ruling {
  date: string
  source: string                      // citation
  text: string
}
```

## Collection

One entry per `(gameId, cardId)`, persisted in `data/collection/<gameId>.json`
as a map keyed by `cardId`.

```ts
interface CollectionEntry {
  qty: number
  promoQty: number
  notes?: string
}
```

`qty` and `promoQty` are tracked separately because promos don't count toward
"set completeness" for the base set but do count toward total ownership.

## Set ownership (derived)

Not persisted. Computed from `CollectionEntry × CardSet.cards`. Exposed via a
React selector / GraphQL field at build time.

```ts
interface SetOwnership {
  setId: string
  ownedDistinct: number
  totalDistinct: number
  ownedCopies: number
  expectedCopies: number              // from the per-box rule for that game
  complete: boolean
}
```

## Deck

One file per deck under `data/decks/<gameId>/<deckId>.json`.

```ts
interface Deck {
  id: string                          // uuid or slug
  gameId: string
  formatId: string
  name: string
  origin: 'own' | 'imported'
  importedFrom?: string               // URL or text source

  zones: Record<string, DeckEntry[]>  // keyed by DeckZone.id
                                      // e.g. { dynasty: [...], conflict: [...] }

  built: boolean
  enforceErrata: boolean
  publisherFilter: PublisherFilter

  notes?: string                      // freeform write-up (markdown)
  createdAt: string                   // ISO
  updatedAt: string                   // ISO
}

interface DeckEntry {
  cardId: string
  qty: number
}

type PublisherFilter =
  | { mode: 'official-only' }
  | { mode: 'include-third-party' }
  | { mode: 'custom'; allowedPublisherIds: string[] }
```

## Price log

Append-only JSONL at `data/prices/<gameId>.jsonl`. Latest-by-card is derived
on read.

```ts
interface PriceEntry {
  cardId: string
  date: string                        // ISO
  value: number
  currency?: string                   // ISO 4217: "USD" (default), "CAD", etc.
                                      // Omitted = USD.
  source: string                      // URL or human description
  notes?: string
}
```

## Sell list

```ts
interface SellList {
  id: string
  name: string
  createdAt: string
  items: SellListItem[]
}

interface SellListItem {
  gameId: string
  cardId: string
  qty: number
  askingPrice?: number                // override of latest known
  currency?: string
}
```

The list view computes total value from latest `PriceEntry` per card, falling
back to `askingPrice` when set.

## Wishlist

Single file at `data/wishlist.json`.

```ts
interface WishlistEntry {
  id: string
  kind: 'card' | 'product'
  gameId: string
  targetId: string                    // cardId for kind=card, setId for kind=product
  desiredQty?: number                 // for cards
  priority?: number                   // user-orderable; lower = higher priority
  notes?: string
  addedAt: string
}
```

Pre-release cards are represented by adding a `CardSet` with
`status: 'preview'` plus stub `Card` records (best-known info). The Wishlist
references them by ID like any other card. When the real set releases, the
stubs are flesh out in place and the WishlistEntry survives.

## Games-played log

Append-only JSONL at `data/notes/games-played.jsonl`.

```ts
interface GameLogEntry {
  id: string
  gameId: string
  date: string                        // ISO
  deckIds: string[]                   // your decks involved
  result?: 'win' | 'loss' | 'draw'    // optional; omit for co-op / N/A
  notes?: string                      // freeform — opponents, scores,
                                      // scenarios, anything else
}
```

Intentionally minimal: only the bare structured fields needed for per-deck
W/L/D stats, with everything else (opponents, scoring details, scenario
names, etc) captured as freeform text in `notes`.

Per-deck stats (W/L/D, recent games) are derived on read from entries that
have a `result` set.

## File slicing rationale

| Data | Layout | Why |
|------|--------|-----|
| Games, publishers | One file each | Small, global, frequently referenced |
| Sets | Per game, per set | Cleanly sliced; previews land as small new files |
| Cards | Per game, per set | Keeps individual files browseable; matches how data arrives |
| Collection | Per game, single file | Hot read/write path; per-game keeps writes small |
| Decks | One file per deck | Easy to import/export, git history is per-deck |
| Prices | Per game, JSONL | Append-heavy, time-series shape |
| Games-played | Single JSONL | Append-only, cross-game stats |
| Wishlist | Single file | Small, cross-game |
| Sell lists | One file per list | Easy to share, easy to delete |

## Identifier conventions

All entity IDs are **stable identifiers**: once an ID is committed to
`data/` (and therefore likely already in a published URL), it is
immutable. The ID is the URL contract — see "URL stability" in
[01-architecture.md](01-architecture.md). Renaming an entity changes its
`name`, not its `id`.

- **Game IDs:** kebab-case slug. `l5r-lcg`, `netrunner`, `mtg`,
  `vampire-rivals`, `vtes`, `flesh-and-blood`, `lotr-lcg`, `arkham-lcg`.
  Locked at Phase 0.
- **Publisher IDs:** kebab-case slug. `ffg`, `null-signal`,
  `wizards-of-the-coast`, `homebrew-<source>`. Locked as records are
  created.
- **Set IDs:** kebab-case slug. Convention picked in Phase 0; same ID
  scheme for every game (e.g. just `core-set`, `defenders-of-rokugan`,
  scoped by game in the directory path, not in the ID itself). Avoid
  prefixing with `gameId` since the URL already encodes the game.
- **Card IDs:** game-scoped unique. Default convention:
  `<setId>-<num>` (e.g. `core-set-001`). Per-game module can override
  if the game has a different established ID scheme (e.g. NetrunnerDB
  card codes). Locked when the card's set is first published.
- **Deck IDs:** short uuid (so imports don't collide with existing
  decks). Locked at creation.
- **Sell-list IDs, wishlist entry IDs, game-log entry IDs:** short
  uuids. Locked at creation.

When in doubt, pick the ugliest-but-correct ID over the prettiest one,
because the ID lasts forever.
