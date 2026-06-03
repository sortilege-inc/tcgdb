# 04 — Features & Phases

A rough rollout plan. Phases are intended to ship incrementally — each phase
should leave the site in a working, usable state, not a half-built one.

## Phase 0 — Scaffolding

- Repo skeleton with the directory layout from
  [01-architecture.md](01-architecture.md).
- Gatsby + TypeScript baseline.
- Sidecar Node/Express skeleton with `GET /api/state` returning fixture data.
- React state layer that reads from sidecar (or static snapshot when
  `GATSBY_READ_ONLY=true`).
- `GameModule` interface and stub implementations registered for all eight
  games.
- One placeholder game with one placeholder card + one placeholder set just so
  the build doesn't crash.
- `ActiveGameProvider` context + top-nav game switcher + route prefix
  (`/games/<gameId>/...`) + placeholder per-game theme (primary colour only).
- CI step that runs `gatsby build` + sidecar smoke test.

**Exit criterion:** `gatsby develop` + sidecar both run; the site renders a
game picker home page, the switcher in the nav lets me activate any of the
eight stubbed games, and activating a game changes the URL prefix and the
accent colour of the page.

## Phase 1 — Card browsing (read-only side)

- Game picker home page.
- Per-game card index with paginated results.
- Card detail page using each game module's `cardDisplaySchema`.
- Generic search/filter UI driven by each module's `searchableFields`.
- Set/product index per game.
- **L5R card data populated** from the existing CSV via a one-shot import
  script (`scripts/import-l5r-csv.ts`).

**Exit criterion:** I can navigate to L5R, browse all cards, and view any
card's detail page.

## Phase 2 — Collection tracking

- Collection UI: per-set table with +/- buttons per card.
- Per-set ownership view with "complete" badge (uses
  `expectedCopiesPerBox`).
- Sidecar mutation working end-to-end: increment/decrement persists to disk.
- Promo qty tracked separately.
- **L5R collection ported** from the existing inventory JSON via a one-shot
  import script (handling instance suffixes like "Core Set 1" by collapsing
  to base set).

**Exit criterion:** I can adjust L5R collection counts and see them persist
through a `gatsby develop` restart.

## Phase 3 — Decks (own + imported)

- Deck CRUD UI.
- Deck list view per game; filter by origin (own / imported).
- Deck section view (uses `deckSections`).
- Deck stats (uses `computeDeckStats`).
- Deck legality check (calls `validate`); inline error/warning display.
- Notes (markdown freeform).

**Exit criterion:** I can create an L5R deck, see its stats and "no rules
implemented yet" warning, and persist it.

## Phase 4 — Built decks & collection-aware filters

- "Built" toggle on deck with sidecar-side constraint enforcement.
- Deck filter: "owned X/Y" plus secondary metric "would-be-owned ignoring
  built decks" — surface both numbers so the user can distinguish "tied up in
  built decks" from "actually missing."
- Conflict UI: when toggling built / editing built deck / decrementing
  collection triggers a violation, surface the offending decks and cards with
  resolution options.

**Exit criterion:** I can mark a deck built, the system blocks a conflict,
and the deck filter shows X/Y correctly across both interpretations.

## Phase 5 — Errata + rulings

- Card detail page renders text-as-written, errata block (when present), and
  rulings.
- Per-deck errata toggle.
- Legality / display uses the effective card per the toggle.
- One-shot data entry for a handful of L5R errata to validate the model.

**Exit criterion:** I can flip the errata toggle on a deck and the legality
result changes when an errata-affected card is involved.

## Phase 6 — Prices + sell list

- Manual price entry per card.
- Price history view per card.
- Latest-value lookup function used across the app.
- Sell list CRUD; total value computed from latest prices.
- Stub for scraper scripts: out-of-band Node scripts that POST `PriceEntry`s
  to the sidecar. Actual scraper logic per source is deferred.

**Exit criterion:** I can record three prices for one card and see history;
I can build a sell list and see a total.

## Phase 7 — Wishlist

- Wishlist CRUD with card-level and product-level entries.
- Priority ordering (drag or numeric).
- Pre-release / preview-set stubbing protocol documented and exercised:
  add a preview set, add a stub card, wishlist it.

**Exit criterion:** I have at least one preview-set card on the wishlist and
the workflow for promoting it on release is documented.

## Phase 8 — Game logs / notes — *v1 freeze candidate*

- Game-played log: per-game entry form (date, deck used, result, notes).
- Per-deck W/L/D summary derived from the log.
- Recent-games view across all games.

**Exit criterion:** I can record three game logs and see win rates per deck.

**v1 declaration:** Phase 8 is the tentative point at which v1 is declared
and URLs are frozen. From this point on, URL structure / IDs / query param
keys are immutable contracts; any change requires a redirect entry rather
than a rename. (The exact freeze point can be moved earlier or later up to
the moment it happens — but Phase 8 is the current default.)

## Phase 9 — Iconography, theming, read-only deploy

- Per-game icon bundles (L5R clans, Netrunner factions, etc.) added as
  components — SVGs recreated from references, imported as React components.
- Per-game theme elaboration: full palettes, optional font choices,
  decoration assets — replacing the Phase 0 placeholder primary-colour-only
  themes.
- Read-only deploy pipeline: env-flag-driven build, full-state snapshot
  bundling (all `data/` content included — no redactions), target host
  (Netlify/Vercel) chosen, hosted.
- Disabled mutation UI in read-only mode confirmed working.

**Exit criterion:** I can `gatsby build` with the read-only flag and deploy
to a static host; from another device, I see my full state but no mutation
buttons.

## Phase 10 — Second game (Netrunner)

- Real `GameModule` implementation for Netrunner (replaces stub).
- Card + set data imported (likely from NetrunnerDB's public JSON via a
  one-shot script).
- Decklist import support deferred — initial decks entered manually or
  via one-shot script, same as L5R.

**Exit criterion:** Same coverage for Netrunner as L5R has.

## Phase 11+ — Remaining games

Each remaining game is its own mini-phase, scoped per its complexity:

- **Arkham Horror LCG** — co-op, investigator + player deck zones,
  encounter/scenario distinction.
- **Vampire: Rivals** — newer game, smaller card pool initially.
- **VtES** — crypt + library, distinctive structure.
- **Flesh & Blood** — hero + main deck + equipment.
- **LOTR LCG** — co-op, heroes + player deck + encounter sets.
- **MTG** — biggest scope; scope to be specified at bring-up time
  (we will *not* attempt full handling of all formats / sets). You'll tell
  me which subset is in scope when MTG comes up next.

## Cross-cutting tasks (any phase)

- **Importers**: deferred until at least one game is fully populated by
  manual entry / one-shot scripts. Added per game once the case for them
  is clear.
- **Validators library**: refactor of shared rule helpers when a second
  module reveals duplication.
- **Search syntax**: text-based query language for power users — likely
  introduced in Phase 1 in basic form, extended over time.
