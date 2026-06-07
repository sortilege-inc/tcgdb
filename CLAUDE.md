# tcgdb — project rules

## What this project is
- **Catalog**: card data, set definitions, images (`data/cards/`, `data/sets/`, `static/cards/`).
- **Collection**: per-game tracking of what the user owns (via the Express sidecar).
- **Decks**: building, listing, validating against game-specific rules (`src/games/<game>/validators/`).
- **Browse**: Gatsby site for searching the catalog, viewing card detail / set detail / collection / decks.

A separate **play engine**, `tcggg`, lives at `../tcggg/` (sibling repo). It is responsible for *playing* games. It is NOT part of this project.

## Boundaries with tcggg

- **They are separate projects.** Separate code, data, build, deploy, dependencies. Do not introduce shared monorepo tooling without an explicit ask.
- **If a change request might cross the boundary, ASK FIRST.** Don't guess.
  - Examples that belong here: card scrape, deck validation, card-detail page, collection mutation, browse UI, set definitions, errata, hover preview.
  - Examples that belong in tcggg: turn-phase state machine, in-game tokens (fate / honor / rings / status), the board UI, conflict resolution flow, multiplayer / lobby.
  - Ambiguous cases (e.g. "show fate cost on the card"): ASK.
- The L5R rules skill at `.claude/skills/l5r-rules/SKILL.md` is shared reference material — both projects' game-rules work should anchor on it.

## How decks flow tcgdb → tcggg

- **Today** (the short-term plan): an "Export" button on the deck-detail page downloads the full deck as JSON, including every card's full record inline (not just cardIds — tcggg is not allowed to assume it has the cards).
- **Later**: an HTTP API on the sidecar (or a sibling process) that tcggg pulls from. Same payload shape.
- The exported JSON must be **self-contained** — tcggg should be able to load it and play a game with zero ambient knowledge of tcgdb's catalog.
- Card images: TBD whether the export embeds image data, includes URLs to a hosted location, or both. (See open question.)

## What goes here

- Card catalog ingestion + merge scripts (`scripts/merge-emerald-scrape.ts`, `scripts/extract-rules-pdf.py`, …).
- Schema for `Card`, `CardSet`, `Deck`, `CollectionEntry` (`src/types/data.ts`).
- Sidecar APIs for collection + deck CRUD.
- Deck-build validators (`src/games/<game>/validators/`).
- Browse / collection / deck-build UI (Gatsby pages + templates).
- Rules reference material (`.claude/skills/`).

## What does NOT go here

- In-game state (turn phases, tokens placed during play).
- A board UI showing the game in progress.
- Multiplayer lobby / matchmaking / chat.
- Anything that requires game *execution* (vs game-rules *validation*).

## Working style notes (also see ~/.claude/CLAUDE.md for global rules)

- TypeScript strict; no `any` without justification.
- Long-running scripts: fail fast, surface progress (global rule).
- Never write rules / facts from memory; cite the RRG or other sourced doc (global rule).
- When the user pushes back on a diagnosis, treat that as evidence and re-investigate.
