---
name: l5r-rules
description: Authoritative rules and terminology for Legend of the Five Rings — The Card Game (FFG LCG, 2017-2021). Use when answering questions about L5R card text, rules adjudication, deck construction, conflict resolution, ability timing, or when implementing game logic (validators, play engine, card UI). Cross-references where each concept maps into the tcgdb schema.
---

# Legend of the Five Rings: The Card Game — Rules Reference (Distilled)

A condensed, working knowledge of the L5R LCG (Fantasy Flight Games, 2017-2021).
The authoritative source is the **Rules Reference Guide v17 (August 10, 2021)**,
stored in the repo at `docs/l5r-rules-reference-v17.pdf`. When in doubt, consult
that PDF or its appendices (Timing diagrams, Card Anatomy, Card Clarifications,
Errata).

> "If the text of a card directly contradicts the text of either the Rules Reference
> or the Learn to Play book, the text of the card takes precedence." — RRG, *Jade Rule*

---

## 1. Game at a glance

**Players**: 1v1 (Stronghold and Skirmish formats), 3-player (Enlightenment), or
2v2 (Team Conquest). The default and most-discussed is **Stronghold**.

**Theme**: each player commands one of seven Great Clans of Rokugan
(**Crab, Crane, Dragon, Lion, Phoenix, Scorpion, Unicorn**), plus a pool of
**Neutral** cards usable by anyone. Cards have an optional **splash clan** for
expanding beyond a player's primary clan.

**Win conditions (Stronghold format — three primary paths)**:
1. **Break opponent's stronghold province** — they are eliminated.
2. **Reach 25 or more honor** in your honor pool — you win immediately.
3. **Opponent reaches 0 honor** — they are eliminated.

Card abilities may introduce additional conditions; meeting any wins the game.

**The game ends immediately** when a victory condition is met. If two players
reach a victory condition simultaneously, the first player wins if they
satisfy any condition; otherwise the closest player to the first player's left
who has wins.

---

## 2. Core resources & state

| Concept | What it is | Where it lives |
|---|---|---|
| **Honor** | Currency *and* win condition. Starts at the stronghold's printed honor value; reaches 25 → you win; reaches 0 → you lose. Gained/lost from card abilities, conflict outcomes, and honor bids. | Honor pool (open info) |
| **Fate** | Resource that pays for characters (placed on them; characters discard when fate runs out), event abilities, and some triggered effects. Each round you gain fate equal to your stronghold's printed value, minus your honor bid. | Fate pool (open info); plus fate tokens *on* characters and on unclaimed rings |
| **Glory** | The honor-worthiness of your ready characters. Used only for the Imperial Favor contest at the end of the Conflict phase. Sum of glory on ready characters → higher total takes the Favor. | Printed on each Character card |
| **Influence** | Deckbuilding-only resource. Stronghold's printed influence value is your pool; off-clan Conflict cards have a printed influence cost. Sum of off-clan picks must be ≤ pool. Role cards add +X (Keeper +3 flat, Support +8). | Not tracked in-game; only at deck-build time |
| **Rings** | Five rings — **Air, Earth, Fire, Water, Void** — corresponding to the five elements. Each ring is also a **conflict type**: Air, Earth, Fire, and Water each carry one of *military* or *political*; Void varies. Rings are claimed when a conflict at them is won and grant their ring effect. | Five physical ring tokens on the table between players |
| **Imperial Favor** | A status token that toggles between Military and Political. Awarded to the player with higher glory total at end of Conflict phase. Holder gets +1 skill on participating characters of the matching type. | Single token, toggleable |
| **Honor Bid** | Each Draw phase, both players secretly set a 1–5 dial. Higher bid loses honor *to* the lower bid (transfer). Both players then draw cards equal to their bid. Creates a press-vs-conserve tension. | Honor dial (1–5); not modeled in tcgdb (lives in the play app) |

---

## 3. Card types

L5R has **7 standard card types** plus 2 rare-mode types (`Treaty`, `Warlord`)
used in special modes (not Standard/Stronghold legal).

| Type | Role | Key fields |
|---|---|---|
| **Stronghold** | The deck's "home base." Determines primary clan + starting honor + fate income + influence pool. Placed under a single province at setup. | `clan`, `honor` (starting), `fateIncome` (per turn, renamed from `fate` in our schema), `influencePool`, `strength` |
| **Role** | Modifies deckbuilding only; not in play. Provides influence bonus and/or province-deckbuilding flexibility. Three subtypes: **Keeper of [Ring]** (+3 influence), **Seeker of [Ring]** (swap one province slot for a 2nd of the selected ring), **Support of [Clan]** (+8 influence and locks splash clan). | `roleClassifier`, `roleRing`, `roleClan`, `influenceBonus`, `forcesSplashClan` |
| **Province** | Defends your stronghold; broken when an attacker wins a conflict at it. 5 in a deck, one per element by default. **Elements** are printed as ring symbols. Dual-element provinces count toward both rings; **Toshi Ranbo** (the wildcard) counts as all five. | `elements` (array of rings), `strength`, `clan` (in-clan or Neutral only — provinces can't be splashed) |
| **Character** | The main combatants. Played from your provinces (dynasty) or hand (conflict). Pay fate to put into play; place fate tokens on the character; the character is discarded when their last fate is removed. | `cost`, `military`, `political`, `glory`, `clan`, `traits` |
| **Attachment** | Enchant a character; modify their skills, traits, or abilities. Attaches when played. | `cost`, `militaryBonus` (e.g. `"+1"`, can be `+X`), `politicalBonus`, `traits` (e.g. `Weapon`, `Armor`, `Spell`, `Item`) |
| **Event** | One-shot ability resolved on cast. Played from hand (usually) or from provinces (Dynasty events; very rare). Goes to discard after resolution. | `cost`, `text` |
| **Holding** | Province-only support cards in the Dynasty deck. Stay in the province face-up when revealed; provide passive abilities or strength bonuses to the province. | `strength` (added to its province) |
| **Treaty** | Mode-specific (Multi-player Treaty mode). Two-player diplomatic agreement. **Not legal in Standard/Stronghold.** | `text` |
| **Warlord** | Mode-specific. **Not legal in Standard/Stronghold.** | varies |

### Stronghold Provinces (subtype, not a separate type)

Some Provinces are specifically designated as the "Stronghold Province" — they
go in the **5th province slot** (the one face-up under your Stronghold). The
RRG treats them as ordinary Provinces with extra rules text; they still count
as one of your 5 provinces and obey the element-coverage rule. Examples:
*Forgotten Library*, *Magistrate Station*.

---

## 4. Turn structure (Stronghold format)

A round has **5 phases**. Each phase has framework steps (mandatory, sequential)
and action windows (optional, alternating; players can play characters and
attachments here, or trigger Action abilities). RRG Appendix I gives the full
timing chart on pp. 26–35 of `rules.pdf`.

### I. Dynasty Phase
1.1 begins → 1.2 reveal facedown dynasty cards → 1.3 collect fate
(stronghold income − your last honor bid) →
**1.4 Special Action Window** (players play *characters from provinces only*,
or trigger Action abilities) → 1.5 ends.

### II. Draw Phase
2.1 begins → 2.2 honor bid → 2.3 reveal honor dials → 2.4 transfer honor
(higher bidder transfers to lower bidder) → 2.5 draw cards (each draws equal
to their bid) → ⌬ ACTION WINDOW → 2.6 ends.

### III. Conflict Phase
Players take turns declaring conflicts (default 2 each, one military + one
political, but cards can grant more or change types). Each conflict
follows **Conflict Resolution**:
- 3.2 Declare conflict (attacker picks: contested ring, conflict type, province, attackers)
- 3.2.1 Declare defenders
- 3.2.2 Conflict Action Window (defender goes first here, unlike other windows)
- 3.2.3 Compare skill values
- 3.2.4 Apply unopposed (defender loses 1 honor if they had no defenders and the attacker wins)
- 3.2.5 Break province (attacker wins AND attacker total skill ≥ province strength)
- 3.2.6 Resolve ring effects (winner of an attacker-won conflict resolves the ring's effect)
- 3.2.7 Claim ring (winner places it on their used-ring pile, gaining its standing effect for the round)
- 3.2.8 Return home (participating characters return)
After all conflict opportunities used, **3.4 Determine Imperial Favor**
(higher total glory takes it; tie → no transfer).

### IV. Fate Phase
4.1 begins → 4.2 discard characters with no fate → 4.3 remove 1 fate from
each character still in play → 4.4 place 1 fate on each unclaimed ring →
⌬ ACTION WINDOW → 4.5 ready cards → 4.6 discard from provinces (chosen by
controller) → 4.7 return claimed rings → 4.8 pass first player token →
4.9 ends.

### V. Regroup Phase (in older revisions) — *folded into Fate Phase post-2018.*

---

## 5. Conflicts in detail

### Declaring a conflict
The attacker picks:
1. **A contested ring** (one of the 5 unclaimed rings from the unclaimed ring pool).
2. **The conflict type** (military or political — based on the ring or attacker choice for Void).
3. **The province being attacked** (must be unbroken, except some abilities allow attacking broken provinces).
4. **Attacking characters** — they all bow and contribute their *matching* skill (military or political) to the conflict.

The defender then declares defenders (any of their ready characters) which bow.
Defending characters contribute their matching skill.

### Resolving a conflict
**Total skill** for each side = sum of matching skill of participating characters,
plus bonuses and minuses from card effects. The side with the higher total wins.

- **Tie at 1 or more skill, attacker has ≥1 participant**: attacker wins.
- **Both sides counting 0 skill**, OR no participants from a side: no winner;
  contested ring returns to unclaimed pool.
- Characters with skill of **"—" (dash)** can't participate at all for that type.

### Winning effects
The conflict winner:
- **Resolves the ring effect** of the contested ring (see §5.1 below).
- **Claims the ring** for the round (provides the ring's standing benefit on top
  of the ring effect).
- If attacker wins AND **total skill ≥ province strength**, the province **breaks**
  (turn it face-up if facedown; its text box becomes blank-ish — broken provinces
  retain only certain referenced abilities).
- If attacker wins and defender had **no defenders** declared, **unopposed** —
  defender loses 1 honor.

### 5.1 Ring effects (resolved by the conflict winner)
| Ring | Effect when claimed by the winner |
|---|---|
| **Air** | Either gain 1 honor *or* take 1 honor from the loser. |
| **Earth** | Either you draw 1 card *or* opponent discards 1 random card from hand. |
| **Fire** | Either honor *or* dishonor a character. |
| **Water** | Either ready a character with no fate, *or* bow a character with at least 1 fate. |
| **Void** | Remove 1 fate from a character in play. |

(Plus card abilities can modify or replace these effects.)

### 5.2 Skills and bonuses
- Character cards print a **base** military and political skill (string —
  `"3"`, `"0"`, `"—"`, or `"X"` for variable).
- Attachment cards print a **bonus modifier** to skills (e.g. `"+1"`/`"-2"`/`"+X"`).
- Our schema separates these: `military` (base, on Character) vs `militaryBonus`
  (modifier, on Attachment). Same for political.
- **Skills cannot go below 0** during a conflict (even if math says so).

---

## 6. Status tokens

A character can carry zero or more status tokens. Most are mutually exclusive
with their opposite (Honored/Dishonored) but stack with the others
(fate, bowed, tainted).

| Token | Meaning |
|---|---|
| **Fate** | Pays for the character to remain in play. Remove 1 each Fate phase; at 0, character is discarded. |
| **Bowed** | The character has used a "tap"-style action or participated in a conflict. Bowed characters don't contribute skill. Ready up during Fate phase step 4.5. |
| **Honored** | +1 military / +1 political / +1 glory. Cannot become dishonored. |
| **Dishonored** | -1 military / -1 political / -1 glory. Cannot become honored. |
| **Tainted** | Cannot become Honored. Each round, the player controlling a Tainted character loses honor as defined per card text. (Introduced in *Under Fu Leng's Shadow*.) |

A character that **would become Honored while Dishonored** (or vice versa) just
loses the Dishonored token (returns to normal). The two are mutual cancellers.

---

## 7. Abilities and timing

### Ability classes
- **Constant** — always-on text on a card in play. Resolves implicitly.
- **Action** — triggered ability prefixed `Action:`. Initiates during action
  windows. Most card text is Action abilities.
- **Reaction** — triggered after a specific event happens (`Reaction: After …`).
  Resolved immediately following the triggering event.
- **Interrupt** — triggered when an event would happen (`Interrupt: When …`).
  Resolves *before* and can modify or replace the triggering effect.
- **Forced Reaction / Forced Interrupt** — must trigger if able.
- **Keyword** — printed shorthand like `Sincerity`, `Eminent`, `Restricted`,
  `Pride`, `Covert`, etc. (see §8).

### Timing
- All cards initiating triggered abilities follow the **"start of a triggering
  condition" → interrupts → effect resolves → reactions** order.
- Within each window, players alternate beginning with the first player
  (defender during conflict windows), each may either trigger or pass; the
  window closes when **both consecutively pass**.
- "Would" interrupts have higher priority than "when" interrupts at the same
  trigger.
- Lasting effects evaluate against the game state **at the time they resolve**;
  cards entering play later aren't covered by them unless the lasting effect
  is described as continuous.

### Targeting
- Cards must be **in play** to be targeted unless an ability explicitly cites
  an out-of-play area (e.g. "in your dynasty discard pile").
- A card whose ability cannot resolve at all because of an invalid target
  cannot be triggered; one with at least one valid target *can* trigger and
  resolve whatever it can.

---

## 8. Common keywords (deckbuilding & gameplay)

| Keyword | Meaning |
|---|---|
| **Unique** (◆ symbol) | Only one copy of this card by title can be in play at a time across all players. (Different controllers + same name still conflict.) Can include unlimited copies in deck. |
| **Restricted** | A community keyword set on the FFG/community ban-list. Max 1 copy in deck under that ban-list. Different from the **Restricted Attachment** mechanic (you can attach 2 restricted attachments at once; a third must be discarded). |
| **Limit X per deck** | Override of the default 3-copy rule. Sets an explicit upper bound. (Encoded as `deckLimit` on Card.) |
| **Eminent** | The province starts the game face-up and cannot be turned facedown. (Introduced *Dominion Cycle*.) |
| **Sincerity** | "After this character enters play, draw 1 card." |
| **Courtesy** | "After this character enters play, gain 1 fate." |
| **Pride** | "After this character wins a conflict alone, honor them. After they lose a conflict alone, dishonor them." |
| **Covert** | When declared as an attacker, choose 1 defender to be unable to defend this conflict. |
| **Ancestral** | The attachment cannot be removed from its character by card effects (other than its character leaving play). When the character leaves play, the attachment returns to its owner's hand. |
| **Composure** | Conditional buff — when triggered, look at your honor bid to see if you have "composure" (your bid is lower than opponent's). |
| **Cavalry, Battle Maiden, Bushi, Courtier, Shugenja, Monk, Yōjimbō, Kihō**, etc. — these are **traits** (lowercase noun phrases); referenced by other card text. |

(See `rules.pdf` Appendix III for the full keyword + clarifications glossary.)

---

## 9. Card-text token reference

Card text (in our scraped data and in display) uses inline bracket tokens for
glyphs that the printed card renders as symbols. Confirmed tokens in our
catalog:

| Token | Meaning |
|---|---|
| `[conflict-military]` | Military conflict type symbol |
| `[conflict-political]` | Political conflict type symbol |
| `[clan-crab]`, `[clan-crane]`, `[clan-dragon]`, `[clan-lion]`, `[clan-phoenix]`, `[clan-scorpion]`, `[clan-unicorn]` | Clan mons (small heraldic symbols) |
| `[element-air]`, `[element-earth]`, `[element-fire]`, `[element-void]`, `[element-water]` | Element/ring symbols |

There may be additional tokens we haven't catalogued yet (e.g. shadowlands ring,
honor symbol on stronghold cards); the user noted this is a TODO for a future
review pass.

HTML tags found inline in card text: `<b>` (Action/Reaction/Interrupt
keywords), `<i>` (flavor), `<em>` (emphasis — frequently used around ring
names like `<em>Fire</em> role only`), `<br>` (line break).

---

## 10. Deck construction

(Full validators live in `src/games/l5r-lcg/validators/`. This is the
gameplay-facing summary.)

### Standard / Stronghold formats
- **Exactly 1 Stronghold.**
- **Exactly 1 Role.**
- **40–45 Dynasty cards.** Each must be in-clan or Neutral. *No splash.*
- **40–45 Conflict cards.** Each must be in-clan, Neutral, OR from a single
  splash clan; off-clan picks consume influence.
- **Exactly 5 Provinces.** Each must be in-clan or Neutral. **Each ring**
  (Air/Earth/Fire/Water/Void) must be represented across the 5. Dual-element
  provinces satisfy both their elements; Toshi Ranbo satisfies all five.
- **At most 1 copy of each Province by title.**
- **Up to 3 copies of any other card by title** across Dynasty + Conflict
  combined, unless the card prints `Limit X per deck`.

### Influence (splash budget)
- **Pool** = stronghold's printed influence + role's influenceBonus (Keeper +3,
  Support +8). Flat — Keeper bonuses are *not* restricted to matching-ring cards.
- **Spend** = sum of (off-clan conflict card's `influence` × qty).
- **Spend ≤ Pool**.
- **One splash clan ever** — Dynasty + Conflict + Provinces taken together can
  include cards from your primary clan, Neutral, and *one* secondary clan.

### Roles
- **Keeper of [Ring]**: +3 influence. Ring is identity only — doesn't restrict
  what you can splash.
- **Seeker of [Ring]**: provinces — swap one province slot for a 2nd of the
  Ring's element. End state: 2 of one element, 0 of one other.
- **Support of [Clan]**: +8 influence and **locks** your splash clan to that
  clan. (Overrides player choice.)
- **"X role only"** card text: encoded as `roleRestriction` — the deck's role
  must satisfy the constraint (ring / classifier / clan).

### Skirmish format (different deck rules; not yet fully validated in tcgdb)
- No Stronghold, no Role, no Provinces.
- 30–40 Dynasty, 30–40 Conflict.
- 2-copy max (not 3).
- Flat **6 influence** instead of stronghold-dependent.
- Sideboard of up to 10 additional cards for tournament play.

### Banned/Restricted
- Encoded per-card via `legalIn: { standard?, stronghold?, skirmish? }`.
- States: `'legal' | 'restricted' | 'banned'`. Absence means legal.
- `'restricted'` means max 1 copy in that format.

---

## 11. Formats summary

| Format | Players | Decks | Notes |
|---|---|---|---|
| **Stronghold** | 1v1 | Standard rules | The flagship; win by breaking opponent's stronghold OR 25 honor OR 0 honor. |
| **Skirmish** | 1v1 | No Strongholds/Roles/Provinces; 30–40 each deck; 2-copy max | Win by breaking all 3 opponent's provinces OR 12 honor OR 0 honor. |
| **Enlightenment** | 3+ | Standard rules | Win by collecting all five rings on your provinces OR 25 honor OR breaking opponent's stronghold. |
| **Team Conquest** | 2v2 | Standard rules with team modifications | Both opponents must lose their stronghold for the opposing team to win, OR a team reaches 50 honor. |

---

## 12. tcgdb implementation cross-reference

| Concept | Schema field | Code location |
|---|---|---|
| Stronghold income / honor / influence | `fateIncome` (renamed from `fate`), `honor`, `influencePool` | `src/types/data.ts` |
| Province element(s) | `elements: string[]` (dual-element supported) | `src/types/data.ts` |
| Character base skills | `military: string`, `political: string` (strings to preserve `—`) | `src/types/data.ts` |
| Attachment skill modifiers | `militaryBonus: string`, `politicalBonus: string` | `src/types/data.ts` |
| Role classification | `roleClassifier`, `roleRing`, `roleClan`, `influenceBonus`, `forcesSplashClan` | `src/types/data.ts` |
| Card legality per format | `legalIn: { standard?: ..., stronghold?: ... }` | `src/types/data.ts` |
| Deck-build copy override | `deckLimit: number` | `src/types/data.ts` |
| `X role only` text | `roleRestriction: { ring?, type?, clan? }` | `src/types/data.ts` |
| Deck's splash clan | `splashClan` on Deck | `src/types/data.ts` |
| Deck shape validation | `deckShape.ts`, `quantity.ts` | `src/games/l5r-lcg/validators/` |
| Clan line + splash inference | `clanLines.ts` | `src/games/l5r-lcg/validators/` |
| Province element coverage | `provinces.ts` (handles Seeker swap + dual-element + Toshi Ranbo wildcard) | `src/games/l5r-lcg/validators/` |
| Influence math | `influence.ts` | `src/games/l5r-lcg/validators/` |
| Format banned/restricted | `legality.ts` | `src/games/l5r-lcg/validators/` |
| `X role only` enforcement | `roleRestrictions.ts` | `src/games/l5r-lcg/validators/` |
| Composite validator | `validate.ts` | `src/games/l5r-lcg/` |

---

## 13. Glossary (top terms, alphabetical)

**Ability** — Special game text on a card. Classes: Constant, Action, Reaction,
Interrupt, Keyword. Some Reactions/Interrupts are Forced.

**Attacker / Defender** — The active player in a conflict (declares it,
contributes attackers) vs the other player (declares defenders).

**Bow** — Turn a card sideways; signals "has acted." Bowed characters
don't contribute skill; bowed strongholds don't generate effects.

**Break (a province)** — Reduce its strength to 0 via conflict damage or
card effect; the province text becomes effectively blank-ish, and certain
on-break effects fire. A broken stronghold province ends the game (loss).

**Claim (a ring)** — Move a ring from the unclaimed pool to your claimed pool
after winning a conflict at that ring. Grants both ring effect AND
its passive while-claimed benefit for the round.

**Conflict** — A combat-like declaration during the Conflict Phase. Has a
contested ring, a conflict type (military/political), a target province, and
attacking/defending characters. Resolved by total skill comparison.

**Contested Ring** — The ring chosen by the attacker as the conflict's target
ring. The winner claims it.

**Discard pile** — Each player has two: a Dynasty discard pile and a Conflict
discard pile, fed from the respective decks.

**Dishonor (verb / status)** — Place a dishonored status token on a character;
gives -1 military / -1 political / -1 glory. Can also be a province-state
(some abilities dishonor provinces).

**Duel** — A specialized resolution between two characters (one chosen by each
side) where both reveal honor bids; honor differences and the chosen character's
skill determine the duel winner.

**Eligible target** — A card the targeted ability can actually affect. An ability
cannot trigger if it has zero valid targets at trigger time.

**Eminent** — A Province keyword: starts face-up; cannot be turned facedown
during normal play; cannot be the Stronghold Province (placed in one of the
non-stronghold slots).

**Empire / Empty Throne** — Flavor reference; mechanically the Empress/Emperor
position is empty in most timeline-late sets.

**Errata** — Official corrections to printed card text. Stored under the
`errata` field on a Card; surfaced when a deck has `enforceErrata: true`.

**Eventless** — A deck-building keyword: "deck contains zero Event cards."
Rare; appears in some role abilities.

**Facedown / Faceup (province)** — Default state for non-broken non-Eminent
provinces is facedown. Revealed during conflicts at that province.

**Fate (resource and token)** — Already covered in §2. Spent to play characters
and most card abilities; placed on characters to keep them in play; on
unclaimed rings to be collected by the next claimant.

**First Player Token** — Held by the player who acts first in most action
windows. Passed to the other player at the end of each Fate Phase.

**Glory** — A character's "fame" stat; sums across ready characters to determine
Imperial Favor each round.

**Holding** — A card type that occupies a Dynasty province slot, providing
passive effects + adding its strength to the province for conflict purposes.

**Honor** — Already covered in §2. Tracked on a token-pool basis; also
transferred during Honor Bids.

**Honored** — Status token on a character; +1/+1/+1.

**Honor Dial** — Player's secret bid (1–5) used each Draw Phase. Loser of
honor-bid comparison gains honor; winner draws more cards.

**Imperial Favor** — Toggleable Mil/Pol token awarded after the Conflict
Phase to the higher-glory player. Holder's matching-type participants get +1
skill in subsequent conflicts.

**Influence (cost / pool)** — Already covered in §2 and §10. Deckbuilding-only.

**Keyword** — Pre-defined shorthand for a known effect (Sincerity, Eminent,
Pride, etc.). Always applies if present; some are optional via "may" phrasing.

**Lasting effect** — An effect that persists across multiple game steps. Has
an explicit expiration condition.

**Limit X per deck** — Overrides default 3-copy rule. `deckLimit` in schema.

**Military / Political** — The two conflict types and the matching skill
categories on characters.

**Monstrous** — A character keyword; Monstrous characters can't be bowed by
non-Monstrous characters' abilities. (Restricted to specific sets.)

**Pride** — A character keyword; honors on solo win, dishonors on solo loss.

**Province deck / Province slot** — The 5-card pool of provinces. Slot 5 (under
the Stronghold) is the "Stronghold Province" slot; gets revealed last and
breaks it = game loss.

**Provincial cards** — Synonym for "Dynasty cards" (cards from the Dynasty deck
that come from provinces).

**Ready** — Untap a card (reverse of bow). Standard recovery happens in Fate
Phase 4.5.

**Reset** — Some cards refer to "resetting" the game state, e.g. shuffling
discard piles back.

**Restricted (gameplay keyword)** — Some attachments have the Restricted
keyword. A character cannot have more than 2 Restricted attachments at once;
if it gains a 3rd, you must discard one immediately.

**Ring effects** — Already covered in §5.1.

**Role** — Already covered (§3, §10). Out-of-play card alongside the Stronghold.

**Seeker / Keeper / Support** — Role subtypes (§3).

**Sincerity** — Character keyword: "After this character enters play, draw 1 card."

**Skirmish format** — Already covered (§10, §11).

**Splash clan** — Already covered (§10). One secondary clan per deck.

**Status tokens** — Already covered (§6).

**Stronghold Province** — Already covered (§3). The Province slot under your
Stronghold; ending the game when broken.

**Tainted** — Status token introduced in *Under Fu Leng's Shadow*. Tainted
characters cannot be Honored and trigger ongoing honor loss for their controller.

**Total skill** — Sum of matching-type skill across a side's participating
characters in a conflict.

**Triggered ability** — Action / Reaction / Interrupt — any ability initiated
by a player choice with a colon-style prefix.

**Unique** (◆) — Already covered (§8).

**Unopposed** — Attacker wins a conflict with no defenders declared.

**Void character** — A character whose printed skill in a category is `"—"`
(dash). Cannot participate in conflicts of that type at all.

**Yōjimbō** — A trait (bodyguard). Often the target of "you cannot target X with
abilities unless X is Yōjimbō" effects.

---

## 14. Practical guidance for Claude

When answering questions about L5R cards or rules, **anchor on**:

1. **Card text overrides general rules.** If a card's text contradicts the
   RRG or this skill, the card wins.
2. **Use the RRG (`docs/l5r-rules-reference-v17.pdf`) as the source of truth.**
   This skill is a condensation, not a replacement. To re-extract the text,
   run `python -u .tmp/extract-rules-pdf.py` (script gitignored but
   easy to recreate); output lands in `.tmp/rules-text.txt`.
3. **Schema fields in tcgdb might lag behind reality.** If a question depends
   on a field we don't track (e.g. game-time tokens), say so explicitly.
4. **Deck-building math lives in `src/games/l5r-lcg/validators/`.** Read those
   files before re-implementing or critiquing — they encode the rules already.
5. **Card-text rendering**: card text in our data has `<b>`, `<i>`, `<em>`,
   `<br>` HTML tags plus inline `[token]` symbols. Tokens are NOT yet rendered
   as glyphs; they appear as literal `[element-fire]` strings until the
   token-rendering pass is done.
6. **Errata field exists but is sparse.** Most cards have no errata; the few
   that do have it under `card.errata` as a partial-Card override that
   applies when `deck.enforceErrata` is true.
7. **Treaty and Warlord cards** are present in the catalog but marked
   `legalIn: { standard: 'banned', stronghold: 'banned' }` (or should be).
   They're for special-mode play that isn't validated yet.
