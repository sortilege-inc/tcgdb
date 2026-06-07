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

**Today** — an "Export" button on the deck-detail page downloads a single JSON file with the following shape:

```jsonc
{
  "exportVersion": 1,
  "exportedAt": "2026-06-06T22:30:00.000Z",
  "deck": {
    "id": "...", "gameId": "l5r-lcg", "formatId": "stronghold",
    "name": "...", "splashClan": "...",
    "zones": { "stronghold": [...], "dynasty": [...], "conflict": [...] },
    "enforceErrata": true, "notes": "..."
  },
  "cards": {
    "<cardId>": { /* full Card record, including text/stats/elements/etc. */ }
  }
}
```

- The JSON is **self-contained for gameplay data**. tcggg can render and play with no other knowledge of tcgdb's catalog.
- **Card images are referenced by URL** (`/cards/l5r-lcg/<cardId>.<ext>` style, pointing at tcgdb's static host). The export does NOT embed base64 image data. To see images in tcggg, the tcgdb host must be reachable.
- **Later**: an HTTP API on the sidecar (or a sibling process) that tcggg pulls from. Same payload shape.

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
