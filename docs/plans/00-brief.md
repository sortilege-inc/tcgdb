# 00 — Project Brief

## What this is

A single-user, locally-hosted (and optionally read-only-deployed) collection,
deckbuilding, sell-list, and notes tool for a personal trading-card-game
collection that spans multiple games. The user (sole user) is the project owner.

## Why it exists

Existing community sites (NetrunnerDB, ArkhamDB, Moxfield, etc) each handle a
single game well, but none of them:

- Span multiple games under one roof.
- Distinguish "what cards exist" from "what cards I personally own."
- Track which decks are physically built and resolve conflicts that arise when
  built decks compete for the same cards.
- Track per-card price history and surface a sell list valued at the latest
  prices.
- Treat homebrew / third-party publishers as first-class alongside official
  content.

This project consolidates all of that into one site, driven by JSON files in a
git repo, served by Gatsby.

## Core principles

- **Single user, single source of truth.** No accounts, no multi-user concerns,
  no public-facing comments or social features. The JSON files in the repo are
  the authoritative state.
- **Static-feeling, mutation-capable.** Gatsby provides the read-only,
  GraphQL-queryable layer (card definitions, sets, errata, rulings). A local
  sidecar API handles mutation of collection/decks/prices/notes/wishlist,
  writing JSON to disk.
- **Multi-game from day one.** The architecture treats "game" as a first-class
  axis. Per-game code modules express rules; declarative JSON expresses data.
- **Built decks are physical.** A deck marked "built" represents cards that are
  actually sleeved and set aside. The system enforces that no two built decks
  can claim the same card and that the collection contains enough copies.
- **Active game drives the UI.** A persistent game-switcher in the top nav
  selects an "active game" that themes the interface and swaps in that game's
  search / deckbuilding / display behavior. Most pages are game-scoped; a
  small set of cross-game pages (wishlist, sell lists, game logs, overview)
  live at the top level.
- **URLs are durable.** Once v1 is declared, every published URL is a
  permanent commitment. Pre-v1 we iterate freely; post-v1, structure
  changes only via redirects, never by breaking the old form.

## Launch game scope (stubbed)

The framework supports all eight games at launch. Real card data is filled in
over time, starting with the games where reference material is most complete.

- Legend of the Five Rings LCG
- Android: Netrunner LCG
- Arkham Horror LCG
- Vampire: Rivals
- Vampire: The Eternal Struggle
- Flesh & Blood
- The Lord of the Rings LCG
- Magic: the Gathering

Each game gets a stub `GameModule` returning "no rules implemented yet" so the
browse / collection paths work even before per-game rules are written.

## Out of scope

- Multi-user features (auth, sharing, public decklists, comments, social).
- Real-time sync across devices. The deployed read-only build is a snapshot.
- Game-playing simulation. The site validates *deck construction*, not game
  play.
- A general-purpose marketplace. Price scraping is supported; transacting is
  not.

## Success criteria

- I can browse cards for any game I have data loaded for, and search/filter
  using game-appropriate fields.
- I can record what I own (per game, per card, with promo copies tracked
  separately) and see which sets are complete.
- I can save decks (my own and imported third-party decks), see legality
  against a chosen format, and filter for "decks I can build from collection."
- I can mark a deck as "built" and the system prevents conflicts.
- I can record prices over time and produce a sell list valued at latest
  prices.
- I can maintain a wishlist that includes pre-release stubs.
- I can record game-played notes and pull win/loss stats per deck.
- State persists in JSON files in the repo, and a static read-only snapshot can
  be deployed for viewing from other devices.
