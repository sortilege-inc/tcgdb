# 05 — Open Questions & Deferred Decisions

A log of things we deliberately did not decide yet. Each entry says when
it has to be decided by.

## Architecturally deferred (decide before the relevant phase)

### Image strategy

**Question:** Where do card images live? Local repo (size concern), separate
asset directory, CDN, optional/skipped?

**Decide by:** After everything else is working. Until then, all UI tolerates
missing images.

**Leading options:**
- Local repo, optional per card, sliced by `data/cards/<game>/<set>/img/`.
- Separate `assets/` directory git-ignored, with a manifest in the repo.
- External URLs only.

### Iconography pipeline

**Question:** SVGs in repo as React components, sprite sheet, or raw files
referenced by path? SVGs will likely be recreated based on references.

**Decide by:** Phase 9 (polish + iconography).

**Leading approach:** SVGs in repo, imported as React components via a
small build helper. Each game's icons live in `src/games/<game>/icons/`.

### MTG-specific design and scope

**Question:** MTG has color-identity rules, many formats (Standard, Modern,
Legacy, Commander, Pauper), and ~25,000+ cards. The data model and module
need extra care, and we will not be attempting full MTG handling.

**Decide by:** When MTG is up next in the queue. Scope (which formats /
which sets / which card subset) will be specified at that time. No data work
on MTG until then.

### Set/product completeness rules for non-L5R games

**Question:** Each game has its own per-box expected-copy semantics. L5R is
documented (in [unsorted/inventory_notes.txt](../../unsorted/inventory_notes.txt));
Netrunner, Arkham, etc. each need their own rule.

**Decide by:** Per game, at its bring-up phase.

### Deck import format coverage

**Question:** Which import formats per game? NRDB JSON, NRDB plaintext,
Moxfield, Archidekt, MTG Arena clipboard, FFG OCTGN exports, etc.

**Decide by:** Per game. Deferred entirely until at least one game is
fully bring-upped without importers (manual entry / one-shot scripts cover
initial population).

## Confirmed decisions worth restating

These were decided after the initial plan draft.

- **Read-only deploy snapshot includes everything.** No data is private; the
  deployed read-only build contains the full collection, decks, prices,
  wishlist, and games-played log.
- **Game-played notes are minimal.** Just `(date, deckIds, result?, notes)`.
  `result` is `'win' | 'loss' | 'draw'` and is optional (for co-op games or
  scenarios where W/L/D doesn't apply). All free-form detail goes in
  `notes`. No per-game `scoreDetails` field.
- **Custom-publisher add flow.** When creating a set, the UI offers an
  autocomplete over existing Publisher records and allows entering a new
  one inline. New publishers default to `third-party` status until the user
  marks them otherwise for a given game.
- **Currencies on prices default to USD** but remain explicit per entry.
  Omitting the currency field on a price entry is interpreted as USD.
- **State backup is git.** No separate snapshot UI. The `data/` directory
  is the source of truth; git history is the version history.
- **Built-deck invariant is enforced in the sidecar (authoritative).** The
  React UI also checks for fast feedback, but the sidecar refuses to write
  an invalid state regardless of what the UI did. This means the JSON on
  disk can never violate the invariant, even from a stale page state or a
  direct API call.
- **Vampire: Rivals = Vampire: The Masquerade — Rivals ECG.** Confirmed.
- **Each homebrew source gets its own Publisher record.** Confirmed
  (e.g. `homebrew-jordan-l5r`, `homebrew-acme-netrunner`).
- **Errata can change any field**, including faction / restriction-relevant
  fields. The effective card is `{...card, ...card.errata}` per-deck when
  the deck enforces errata.

## Cascading questions already answered

For the record (in case we need to revisit):

| Question | Decision | Locked in by |
|---|---|---|
| Persistence model | Local sidecar API writing JSON | Round 1 |
| Hosting target | Local edits, deployed read-only viewing | Round 1 |
| Built-deck allocation | Hard constraint — disallow conflicts | Round 1 |
| Per-game rules | Per-game code module | Round 1 |
| Price tracking | Time series with sources | Round 2 |
| Wishlist pre-release representation | Stubbed in card data | Round 2 |
| Errata scope | Any field | Round 2 |
| Launch game scope | Eight games stubbed; framework first | Round 2 |
| Homebrew publisher model | Per-source Publisher records | Round 3 |
| Read-only deploy data scope | Includes everything | Round 3 |
| Game-played notes shape | Minimal (W/L/D + notes) | Round 3 |
| Set/product publisher entry UX | Autocomplete + inline-new | Round 3 |
| Default currency | USD | Round 3 |
| Backup model | Git history only | Round 3 |
| Active-game concept | Global state + URL prefix + nav switcher + theme | Round 4 |
| URL structure | Game-scoped pages under `/games/<gameId>/...` | Round 4 |
| Theme model | `theme` field on Game, CSS variables, Phase 0 placeholder | Round 4 |
| URL stability | All IDs immutable; v1 freezes URLs; changes require redirects | Round 5 |
| v1 freeze phase | Phase 8 (tentative, can move) | Round 5 |
