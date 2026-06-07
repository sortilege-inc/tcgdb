---
name: l5r-rules
description: Authoritative rules and terminology for Legend of the Five Rings — The Card Game (FFG LCG, 2017-2021). Use when answering questions about L5R card text, rules adjudication, deck construction, conflict resolution, ability timing, or when implementing game logic (validators, play engine, card UI). Every section cites the page in the Rules Reference Guide v17 (August 10, 2021), `docs/l5r-rules-reference-v17.pdf`. Cross-references where each concept maps into the tcgdb schema.
---

# Legend of the Five Rings: The Card Game — Rules Reference (Distilled)

This skill is **sourced**: every factual claim cites the Rules Reference
Guide v17 (RRG), Fantasy Flight Games, August 10, 2021. Page citations like
*(RRG p. 19)* refer to the FFG v17 PDF, which is the **authoritative source
for the default Stronghold format** that tcgdb / tcggg target.

**Three available rule sources** (use in this order of authority):

1. `docs/l5r-rules-reference-v17.pdf` — **FFG official RRG v17** (Aug 10, 2021).
   The PDF is the canonical reference for FFG-era L5R LCG. Use this as the
   primary citation target.
2. `docs/rules-source/Rules Reference Guide.adoc` — **Emerald Legacy RRG v5.0**
   (May 10, 2025). The fan-continuation RRG, in asciidoc source. Cleaner to
   parse than the PDF and useful for cross-checking specific entries (the
   asciidoc is glossary-structured with `_Example:_` blocks, named anchors,
   etc.). EL v5.0 explicitly diverges from FFG v17 in a handful of rulings;
   when it does, **FFG v17 wins for the Stronghold format**. Use EL v5.0 as
   a secondary citation, and note "EL §X" alongside "RRG p. Y" when both
   agree, or "EL diverges, see §X" when they don't. Provenance + scope notes:
   `docs/rules-source/PROVENANCE.md`.
3. This file (`.claude/skills/l5r-rules/SKILL.md`) — distilled, not sourced.
   Use it as a quick index, not as a fact source. When in doubt, re-open
   the source.

The skill is built from text extracted by `scripts/extract-rules-by-column.py`
and structured by `scripts/parse-rrg-glossary.py`. To refresh, re-run those
scripts; outputs land in `.tmp/`. A future refresh pass should also parse the
asciidoc source — much more reliable than the PDF OCR pipeline.

> **The Jade Rule** — "If the text of this Rules Reference directly contradicts
> the text of the Learn to Play book, the text of the Rules Reference takes
> precedence. If the text of a card directly contradicts the text of either
> the Rules Reference or the Learn to play book, the text of the card takes
> precedence." *(RRG p. 2)*

---

## 1. Game at a glance

**Formats** *(RRG p. 2)*:

- **Stronghold format** — two-player head-to-head; players attempt to break
  each others' strongholds.
- **Skirmish format** — two-player head-to-head; players attempt to break
  all three of their opponent's provinces. No stronghold or province cards
  are used.
- **Enlightenment format** — three-player head-to-head; players attempt to
  collect all five rings to achieve enlightenment.
- **Team conquest format** — four-player (2v2); two teams attempt to destroy
  both of the opposing team's strongholds.

The rules in the RRG apply to all formats unless explicitly stated otherwise.

### 1.1 Winning the Game *(RRG p. 24)*

> "In each format, there are three primary paths to victory in the game.
> The game ends immediately if a player meets one (or more) of these victory
> conditions." *(RRG p. 24)*

If all but one player is eliminated, the remaining player wins. Card abilities
may add additional victory conditions; meeting any wins the game. If two
players reach a victory condition simultaneously, the first player wins if
they have; otherwise the closest player to the first player's left who has.

**Stronghold format victory conditions** *(RRG p. 24)*:
- If a player's stronghold province is broken, that player is eliminated.
- The first player to meet the condition of having **25 or more honor**
  in their honor pool wins.
- The first player to have **0 honor** in their honor pool is eliminated.

**Skirmish format victory conditions** *(RRG p. 24)*:
- If all three of a player's provinces are broken, that player is eliminated.
- The first player to **12 or more honor** wins.
- A player at 0 honor is eliminated.

**Enlightenment format victory conditions** *(RRG p. 24)*:
- The first player to **collect all five elemental rings** on their
  provinces wins.
- The first player to **25 or more honor** wins.
- Stronghold-broken or 0-honor → eliminated.

**Team conquest format victory conditions** *(RRG p. 25)*:
- If the stronghold province of each member of one team is broken, that team
  loses.
- The first team to **50 or more honor** wins.

---

## 2. Core resources

### Honor *(RRG p. 11)*

> "Honor represents the behavior of a player's clan, and the outward
> perception of that behavior. It is bid during the draw phase (see framework
> step '2.2. Honor bid' on page 28) and during duels. Honor also serves as
> a victory track to measure an honor win or an honor loss. The amount of
> honor a player has at any given time is represented (as open information)
> by honor tokens in his or her honor pool." *(RRG p. 11)*

- A player's stronghold indicates that player's starting honor total.
- In the skirmish format, each player starts with 6 honor.
- Gained honor comes from the general token pool; lost honor returns to it.
- The honor bid is set on a player's **honor dial** during the draw phase.
- If a card ability references a player's honor bid, it references the
  current setting on the honor dial.

### Fate *(RRG p. 9)*

> "Fate is the game's basic resource, and is used to pay for cards and some
> card abilities. The amount of fate a player has available at any given
> time is represented (as open information) by fate tokens in his or her
> fate pool." *(RRG p. 9)*

- Fate begins the game in the general token pool. Gaining fate moves it to
  the player's fate pool.
- "Place fate on a card" comes from the general token pool unless specified.
- Spent or lost fate returns to the general token pool; fate spent **to a
  ring** is placed on that ring.
- When a player plays a character (from hand or provinces), after the
  character enters play, the player may place any number of fate from their
  fate pool onto that character.
- **Fate phase** *(RRG p. 9)*: characters with no fate are discarded;
  then 1 fate is removed from each character in play; then 1 fate from the
  general token pool is placed on each unclaimed ring.

### Glory *(RRG p. 10)*

Glory is a printed character stat. Used in the **Glory Count** at the end
of the Conflict Phase to determine who claims the Imperial Favor.

- A player's glory count is the sum of glory among ready characters that
  player controls, plus the value of each ring in that player's claimed
  ring pool. *(RRG p. 10, "Glory Count" entry)*
- Other card abilities may count "current glory" among characters; this is
  separate from the glory count and does not add rings.

### Influence *(RRG p. 12)*

> "Influence is the resource used during deckbuilding to allow a player to
> add cards to their conflict deck from a clan other than the player's own.
> Each conflict card has an influence cost printed on its lower right
> corner. The total influence cost of every out-of-clan card in a player's
> conflict deck may not exceed the player's influence limit, as defined by
> their stronghold." *(RRG p. 12)*

(Influence is a deckbuilding-only quantity, not tracked in play.)

### Rings (the five) *(RRG p. 18)*

> "There are five rings in the game, one corresponding to each of the
> Rokugani elements (air, earth, fire, water, and void)." *(RRG p. 18)*

- Each ring begins the game in the unclaimed ring pool.
- A ring is **contested** during conflicts; the winner claims it.
- A claimed ring contributes its value to the holder's glory count for the
  duration of the round (until rings are returned during the Fate phase).
- A player cannot have multiple rings of the same printed element claimed
  on their provinces.

### Ring Effects *(RRG p. 19)*

> "Each time a player wins a conflict as the attacking player, they may
> resolve the ring effect associated with the contested ring's element."
> *(RRG p. 19)*

The ring effects in standard formats *(quoted verbatim, RRG p. 19)*:

- **Air**: Either take 1 honor from your opponent, or gain 2 honor from
  the general token pool.
- **Earth**: Draw 1 card from your conflict deck and discard 1 random card
  from your opponent's hand.
- **Fire**: Choose a character in play and either honor or dishonor that
  character.
- **Water**: Either choose a character and ready it, or choose a character
  with no fate on it and bow it.
- **Void**: Choose a character and remove 1 fate from it.

When a ring has multiple elements (dual-element provinces / wildcard), the
player may choose among those elements when resolving.

In the **skirmish format**, three rings have different effects *(RRG p. 19)*:

- **Air (skirmish)**: Take 1 honor from your opponent.
- **Earth (skirmish)**: Either draw 1 card from your conflict deck or
  discard 1 random card from your opponent's hand.
- **Water (skirmish)**: Choose a character in any player's home area with
  1 or fewer fate on it and either ready or bow it.

### Imperial Favor *(RRG p. 11)*

The Imperial Favor is a status token, contested at the end of the conflict
phase via the **Glory Count**. The player with the higher glory count
claims (or steals) the Favor. A player who has the Favor chooses its
orientation (military or political). A character participating in a conflict
of the matching type gets +1 skill of that type while their controller has
the Favor. *(RRG p. 11 entry "Imperial Favor, Imperial Favor Contest")*

### Honor Bid (Bid Value) *(RRG p. 3 + Setup p. 28)*

The honor bid is set by spinning each player's **honor dial** (1-5) during
framework step 2.2. The dial is revealed simultaneously in 2.3; honor is
transferred from the higher bidder to the lower in 2.4; both players draw
cards equal to their bid in 2.5. *(RRG framework steps 2.2-2.5, p. 28-29)*

- "If the value of an honor bid is modified, resolve that bid as if the
  modified value is that player's bid. The value of a bid may exceed five
  (the highest number on the honor dial), or may be reduced to zero."
  *(RRG p. 3, "Bid Value")*
- "When the value of an honor bid is modified, the setting on the dial is
  not itself adjusted." *(RRG p. 3)*

---

## 3. Card types

Per **Appendix II: Card Anatomy** *(RRG pp. 33-35)* and the glossary,
there are 7 standard card types. The schema and stat anatomy for each:

### Stronghold *(RRG p. 21)*

> "A player's stronghold designates the primary clan and starting honor
> total of that player's deck. Strongholds remain face-up at all times,
> in their starting location… For stronghold card anatomy, see 'Appendix
> II: Card Anatomy' on page 34." *(RRG p. 21)*

Printed values per Appendix II anatomy:
- **Honor** — starting honor total.
- **Fate** — per-turn fate income (renamed in our schema to `fateIncome`).
- **Influence** — deckbuilding splash budget (`influencePool` in our schema).
- **Strength** — the stronghold's defensive strength while attacked.
- A stronghold sits on top of one of the player's provinces; the province
  beneath is the **stronghold province**.

### Role *(RRG p. 19)*

> "A role card is placed alongside a player's stronghold, and provides
> specialized abilities and limitations for that player's deck. A player
> may use a single role card in conjunction with their stronghold while
> assembling a deck. The role card starts the game next to its owner's
> stronghold and is revealed along with the stronghold during setup."
> *(RRG p. 19)*

- Role cards are **not used in the skirmish format**.
- Role cards are **not considered in play**; their text affects the game
  state from the out-of-play area while active beside the stronghold.
- Cards printed as the role card type cannot be removed from the game by
  other card abilities.
- "Some cards have the text, '___ role only.' This is a deckbuilding
  restriction, and is not active during gameplay." *(RRG p. 19)*

In our catalog the three subtypes encountered are **Keeper of [Ring]**,
**Seeker of [Ring]**, and **Support of [Clan]**. Their specific
deckbuilding effects come from the printed card text (e.g. "Increase your
deckbuilding influence value by 3" on Keeper roles), not from the RRG.
(See §10 below; modeled in our schema as `roleClassifier`, `roleRing`,
`roleClan`, `influenceBonus`, `forcesSplashClan`.)

### Province *(RRG p. 17)*

> "A player's provinces represent the lands under their domain. Each
> player begins the game with 5 provinces in play, arranged in a row…"
> *(RRG p. 17, "Provinces, Province Cards, Province Tokens")*

- "Each province card has one or more elements associated with it,
  indicated by the symbol(s) in the lower right corner of the card."
  *(RRG p. 17)*
- Provinces are revealed when attacked; a province is **broken** when an
  attacker wins a conflict against it with sufficient skill (see §5).
- For full anatomy: **Appendix II** *(RRG p. 34)*.

### Character *(RRG p. 4, anatomy p. 34)*

> "Character cards represent the bushi, courtiers, shugenja, monks,
> shinobi, armies, creatures, and other personalities and forces that
> players can use as the agents of their clan." *(RRG p. 4)*

Characters have:
- **Cost** (fate cost to play from hand or provinces).
- **Military skill** (string in our schema — preserves the `—` dash).
- **Political skill** (same).
- **Glory** value.

> "When a player plays a character from their hand during a conflict, that
> character enters play participating in the conflict." *(RRG p. 4)*

### Attachment *(RRG p. 3, anatomy p. 34)*

> "Attachment cards represent weapons, armor, items, skills, spells, and
> conditions that can enhance or impair characters." *(RRG p. 3, full entry
> in "Attachment Cards")*

Key rules *(RRG p. 3)*:
- An attachment cannot enter play if there is no eligible card to attach.
- An attachment can only attach to a character in play, unless its text
  specifies otherwise (some attach to rings or provinces).
- If the card to which an attachment is attached leaves play, the
  attachment is discarded — unless **Ancestral** *(RRG p. 3)*, which
  returns to its owner's hand.
- "An attachment a player controls remains under his or her control,
  even if it is attached to an opponent's card."
- "An attachment card bows and readies independently of the character it
  is attached to."
- Skill modifiers on attachments apply to the character even if the
  attachment is bowed.

In our schema, the printed attachment modifier is stored as a string in
`militaryBonus` / `politicalBonus` (e.g. `"+1"`, `"-2"`, `"+X"`) to
preserve sign and `X`.

### Holding *(RRG p. 11)*

> "When a holding is turned faceup in a player's province, its game text
> becomes active and that holding is considered to be 'in play.' As long
> as a holding remains faceup in a player's province, that player can use
> abilities or benefit from game text on that holding." *(RRG p. 11)*

- Many holdings have a printed strength that modifies the defense
  strength of the province at which they're located.
- During the fate phase, when discarding faceup cards from provinces, a
  player may choose to discard a holding; the province is then refilled
  facedown from the dynasty deck.

### Event *(RRG p. 9)*

> "Event cards represent intrigues, schemes, and unique opportunities that
> can be turned into significant gains." *(RRG p. 9, "Event Cards" entry)*

- Event cards played from a player's provinces cannot be played outside
  of the dynasty phase.
- Event cards with action abilities may be played from a player's hand
  during any action window.
- In the skirmish format, event cards with action abilities cannot be
  played from a player's hand during the dynasty phase.
- When an event card is played, its costs are paid, its effects are
  resolved (or canceled), and it is placed in its owner's appropriate
  discard pile prior to opening the reaction window.

### Treaty *(RRG p. 23)*

> "Treaty cards are included in the Clan War expansion and can be used to
> increase variety when playing the enlightenment format." *(RRG p. 23)*

Treaties are used in the multi-player **Enlightenment format** with the
Clan War expansion's treaty mechanic. **Not legal in Standard/Stronghold**.

### Other type (Warlord) — our catalog includes 6 cards typed `Warlord`
that appear to be mode-specific (Clan War). These are NOT defined in the
RRG glossary; they're flagged as not legal in Standard/Stronghold in our
schema via `legalIn`. (TODO: confirm with the Clan War supplementary
rules document.)

---

## 4. Turn structure

The full **Phase Sequence Timing Chart** is in **Appendix I: Timing and
Gameplay** *(RRG pp. 26-32)*. Below is the framework-step summary; for
the full timing details and action-window placement, consult that
appendix.

### I. Dynasty Phase *(RRG p. 28)*

- **1.1** Dynasty phase begins.
- **1.2** Reveal facedown dynasty cards.
- **1.3** Collect fate (stronghold fate income, minus your last honor bid).
- **1.4** *Special Action Window*: players alternate playing characters
  from provinces or triggering Action abilities. (Cards from **hand** are
  not playable in this window.) *(RRG p. 26, 28)*
- **1.5** Dynasty phase ends.

### II. Draw Phase *(RRG p. 28)*

- **2.1** Draw phase begins.
- **2.2** Honor bid.
- **2.3** Reveal honor dials.
- **2.4** Transfer honor (higher bidder transfers to lower bidder by the
  difference).
- **2.5** Draw cards (each player draws cards equal to their bid).
- *Action Window*.
- **2.6** Draw phase ends.

### III. Conflict Phase *(RRG p. 27, framework details p. 30)*

- **3.1** Conflict phase begins.
- *Action Window*.
- **3.2** Next player in player order declares a conflict, or passes.
  Each player has **two normal conflict opportunities** per phase (one
  military, one political); they alternate.
- **3.3** Conflict Ends / Conflict was passed; return to the action
  window following 3.1.
- **3.4** Determine Imperial Favor.
- **3.4.1** Glory count.
- **3.4.2** Claim Imperial Favor.
- **3.5** Conflict phase ends.

#### Conflict Resolution *(RRG p. 27)*

- **3.2** Declare conflict.
- **3.2.1** Declare defenders.
- **3.2.2** *Conflict Action Window* — the **defender has first
  opportunity** in this window (the one exception to the usual
  first-player priority). *(RRG p. 26)*
- **3.2.3** Compare skill values and determine result.
- **3.2.4** Apply unopposed (if applicable).
- **3.2.5** Break province.
- **3.2.6** Resolve ring effects.
- **3.2.7** Claim ring.
- **3.2.8** Return home. Go to 3.3.

### IV. Fate Phase *(RRG p. 27, framework details p. 31)*

- **4.1** Fate phase begins.
- **4.2** Discard characters with no fate.
- **4.3** Remove 1 fate from characters (in play).
- **4.4** Place 1 fate on unclaimed rings.
- *Action Window*.
- **4.5** Ready cards.
- **4.6** Discard from provinces (controller-chosen).
- **4.7** Return claimed rings.
- **4.8** Pass first player token.
- **4.9** Fate phase ends.

---

## 5. Conflicts

### 5.1 Declaring a conflict *(RRG p. 30, "3.2. Declare conflict")*

The attacker chooses:
1. A **contested ring** from the unclaimed ring pool.
2. A **conflict type** (military or political).
3. An **attacked province**.
4. The **attacking characters**.

The defender then declares defenders.

### 5.2 Breaking a Province *(RRG p. 4)*

> "If the attacking player wins a conflict with a total skill difference
> equal to or greater than the strength of the attacked province, that
> province is broken." *(RRG p. 4, "Breaking a Province, Broken Province")*

Specifically *(RRG pp. 4-5)*:
- A broken province has a blank text box (broken provinces lose their
  printed text).
- Dynasty cards may still be played from broken provinces (so the
  province slot continues to function), with limitations.
- A broken stronghold province ends the game (player eliminated, in
  formats where breaking the stronghold is a victory condition).

### 5.3 Winning a Conflict *(RRG p. 24)*

> "Each conflict is won by the player who counts the highest total skill
> applicable for that conflict type for his or her side when the conflict
> result is determined." *(RRG p. 24)*

Specifically:
- Total skill = sum of matching-type skill of ready participating
  characters on that side, plus modifiers.
- A player must count **at least 1 total skill** and have at least one
  participating character to win.
- If totals are **tied at 1 or greater** and the attacker has at least
  one participant, the **attacker wins**.
- If neither player can meet the requirements (e.g. both at 0), **no
  one wins** — the contested ring returns to the unclaimed ring pool.

### 5.4 Unopposed *(RRG p. 24)*

> "A conflict is unopposed if the attacking player wins the conflict and
> the defending player controls no defending characters at the time the
> conflict winner is determined." *(RRG p. 24)*

- In the stronghold format, an unopposed conflict win costs the defender
  **1 honor** *(framework step 3.2.4)*.
- In team conquest, an unopposed conflict only counts if the **whole
  defending team** has no defenders; if so, **each player on the
  defending team loses 1 honor**.

### 5.5 Conflicts at Multiple Provinces *(RRG p. 5)*

> "When a conflict is at multiple provinces, each of those provinces is
> the 'attacked province' and abilities that interact with the conflict
> being at those provinces can be used. During the resolution of a
> conflict at multiple provinces, compare the attacking player's excess
> skill against the strength of each attacked province separately to
> determine if that province is broken." *(RRG p. 5)*

Any card ability that interacts with "the attacked province" interacts
with one (not both) of those provinces.

---

## 6. Status & character tokens

The complete entries are *Status Token (RRG p. 21)*, *Personal Honor,
Personal Dishonor (RRG p. 16)*, *Tainted (RRG p. 21)*, *Bow, Bowed
(RRG p. 4)*, *Ready (RRG p. 18)*, *Honored Status Token (RRG p. 11)*,
*Dishonored Status Token (RRG p. 8)*.

### Bow / Ready *(RRG p. 4, p. 18)*

- A card is **bowed** when turned sideways. Cards often bow after
  participating in a conflict or using card abilities.
- During conflicts, bowed characters do not contribute their skill.
- A bowed attachment with skill modifiers still modifies the character.
- A card ability on a bowed card is active and can still engage.
- A card is **ready** when upright. Standard recovery happens at
  framework step 4.5.

### Honored / Dishonored *(RRG p. 16, "Personal Honor, Personal Dishonor")*

- A character with an **honored** status token gets **+1 military, +1
  political, and +1 glory**, and cannot become dishonored.
- A character with a **dishonored** status token gets **-1 military, -1
  political, and -1 glory**, and cannot become honored.
- (Quoted directly from RRG p. 16.)
- Honor and dishonor are mutual cancellers — applying one to a character
  that has the opposite token removes the existing token instead.

### Fate (on character) *(RRG p. 9)*

A character with no fate is discarded at framework step 4.2. Each round
at 4.3, 1 fate is removed from each character in play.

### Tainted *(RRG p. 21, "Tainted, Tainted Status Token")*

> "A character's tainted status has no bearing on its personal honor;
> it can still become honored or dishonored." *(RRG p. 22, "Tainted"
> continued)*

Tainted is a status introduced in the *Under Fu Leng's Shadow* expansion.
(Full mechanical effects come from the printed expansion rules.)

---

## 7. Abilities and timing

### 7.1 Ability classes *(RRG p. 2, "Ability")*

> "Card abilities fall into one of the following types: actions, constant
> abilities, interrupts, keywords, and reactions. Some interrupt and
> reaction abilities are also forced." *(RRG p. 2)*

- **Constant Abilities** *(RRG p. 5)*: any non-keyword ability whose
  text contains no boldface timing trigger. Becomes active as soon as
  its card enters play and remains active while in play.
- **Action, Action Ability** *(RRG p. 2)*: triggered card ability with
  the boldface `Action:` precursor. Triggered during action windows.
  Unless noted otherwise, each action ability may be initiated only once
  per round.
- **Reactions** *(RRG p. 17)*: triggered ability prefaced by `Reaction:`.
  Initiated after a specific triggering event.
- **Interrupts** *(RRG p. 12)*: triggered ability prefaced by `Interrupt:`.
  Initiated during the resolution of a triggering event, **before** that
  event completes.
- **Keywords** *(RRG p. 13)*: pre-defined shorthand for known effects.
  Keywords that use "may" are optional; all others are mandatory.

### 7.2 Forced abilities *(RRG p. 10)*

> "An ability prefaced by the word 'Forced' must trigger if able. Cards
> that interact with 'Forced' refer to abilities with this distinction."
> *(RRG p. 10, "Forced (Forced Interrupts, Forced Reactions)")*

Forced abilities are triggered automatically by the game at their
appropriate timing point. The application of these is mandatory *(RRG
p. 2)*.

### 7.3 Triggered Abilities *(RRG p. 23)*

> "A boldface timing command followed by a colon indicates that an
> ability is a triggered ability. Triggered abilities fall into one of
> the following types: actions, interrupts, and reactions." *(RRG p. 23)*

Triggered abilities follow the template:
**triggering condition / cost / targeting requirements – effect**.

Ability text before the dash is conditions/costs/targets; ability text
after the dash is the effect. If there is no dash, the whole text is the
effect.

A triggered ability **can only be initiated** if its effect has the
potential to change the game state on its own, and its cost has the
potential to be paid.

### 7.4 Triggering Condition + the "Would" priority *(RRG p. 23, p. 25)*

The triggering-condition window resolves in this order *(RRG p. 23)*:

1. The triggering condition becomes imminent.
2. **"Would" interrupts** may be used (highest priority).
3. **Forced interrupts** to the imminent condition resolve.
4. Standard interrupt window opens; closes when both consecutively pass.
5. The triggering condition itself occurs.
6. **Forced reactions** resolve.
7. Reaction window opens.

> "All 'would be X' interrupts are eligible to be used before any 'is X'
> interrupts. This means that an interrupt with the word 'would' (such
> as 'when a character would leave play') has timing priority over an
> interrupt without the word 'would' that references that same occurrence
> (such as 'when a character leaves play')." *(RRG p. 25, "The word
> 'Would'")*

### 7.5 Lasting Effects *(RRG p. 13)*

A lasting effect persists beyond the resolution of the ability that
created it, until the specified expiration. The effect engages the game
state **at the time it resolves**; cards entering play later are not
covered by the lasting effect unless described as continuous.

### 7.6 Targeting *(RRG p. 22, "Target")*

Card abilities only interact with, and can only target, cards that are
in play, unless the ability specifically refers to an out-of-play area.

> "If multiple targets are required to be chosen by the same player at
> the same time, those choices are made simultaneously." *(RRG p. 22)*

> "A card is not an eligible target for an ability if the resolution of
> the ability cannot change that card's game state in some way." *(RRG
> p. 22)*

### 7.7 Cancel *(RRG p. 4)*

> "Cancel abilities interrupt the initiation of an effect, and prevent
> the effect from occurring. If the effects of an ability are canceled,
> the ability is still considered to have been used (and its costs are
> still paid)." *(RRG p. 4)*

---

## 8. Keywords (alphabetical, all from the glossary)

Sources cited inline. For deeper text consult the cited glossary entry.

- **Ancestral** *(RRG p. 3)* — Attachment keyword. If the attached card
  leaves play, the ancestral attachment is **returned to its owner's
  hand instead of being discarded**.
- **Composure** *(RRG p. 5)* — Variable keyword. A card with Composure
  gains an additional ability while its controller's honor bid is lower
  than that of one of his or her opponents. "You have composure" is the
  phrase indicating the keyword is active.
- **Corrupted** *(RRG p. 6)* — (Tainted-cycle mechanic; see RRG p. 6 for
  full text.)
- **Courtesy** *(RRG p. 6)* — "After this character enters play, gain
  1 fate." (As printed in the entry summary on RRG p. 6.)
- **Covert** *(RRG p. 6)* — When declared as an attacker, choose 1
  defender to be unable to defend this conflict.
- **Dire** *(RRG p. 8)* — (See RRG p. 8 for full text — *Under Fu Leng's
  Shadow* mechanic.)
- **Disguised** *(RRG p. 8)* — (See RRG p. 8.)
- **Eminent** *(RRG p. 9)* — A province keyword. An Eminent province
  starts the game face-up and cannot be turned facedown; it cannot be
  the stronghold province.
- **Limited** *(RRG p. 13)* — Restricts how often a card can be played
  during a turn (per the glossary entry).
- **Pride** *(RRG p. 17)* — "After this character wins a conflict alone,
  honor them. After they lose a conflict alone, dishonor them." (Glossary
  entry summary; precise text per RRG p. 17.)
- **Rally** *(RRG p. 17)* — (See RRG p. 17.)
- **Restricted** *(RRG p. 18)* — A character cannot have more than 2
  Restricted attachments at one time. If a third is added, one must be
  discarded immediately.
- **Sincerity** *(RRG p. 20)* — "After this character enters play, draw
  1 card."
- **Support** *(RRG p. 21)* — (Glossary entry; clarifies "support"
  references in card text.)

Cycle-specific keywords (Shadowlands, Tainted-related, post-2020 expansions)
are referenced in the glossary but may need separate consultation of the
expansion-specific rules supplements; the RRG provides the canonical
short-form text for each.

---

## 9. Card-text bracket tokens (catalog-derived, NOT from RRG)

Card text in our scraped data uses inline `[bracket]` tokens that the
printed card renders as glyphs. Tokens confirmed in our catalog:

| Token | Glyph rendered |
|---|---|
| `[conflict-military]` | military conflict type symbol |
| `[conflict-political]` | political conflict type symbol |
| `[clan-crab]`, `[clan-crane]`, `[clan-dragon]`, `[clan-lion]`, `[clan-phoenix]`, `[clan-scorpion]`, `[clan-unicorn]` | clan mons |
| `[element-air]`, `[element-earth]`, `[element-fire]`, `[element-void]`, `[element-water]` | ring/element symbols |

The RRG glossary references these symbols in card-anatomy diagrams (e.g.
"clan mon" on p. 5 chart, "ring symbol" on RRG p. 17) but does not
enumerate the token strings — those come from the EmeraldDB scrape
format. A follow-up review pass with the user is open to enumerate any
additional tokens (e.g. shadowlands symbol, honor symbol).

HTML tags found in our scraped card text: `<b>`, `<i>`, `<em>`, `<br>`.

---

## 10. Deck construction *(RRG p. 7)*

Full validators live in `src/games/l5r-lcg/validators/`. The deckbuilding
rules quoted from the RRG:

> "To build custom decks for Legend of the Five Rings: The Card Game:
> A player must choose exactly 1 stronghold. A player may use 1 role
> card. A player's dynasty deck must contain a minimum of 40 and a
> maximum of 45 cards. Each of these cards must be in-clan or be
> neutral. A player's conflict deck must contain a minimum of 40 and a
> maximum of 45 cards. Each of these cards must be in-clan, be neutral,
> or be purchased from a single other clan by using influence." *(RRG
> p. 7)*

> "A player's stronghold indicates the amount of influence that player
> may spend during deckbuilding." *(RRG p. 7)*

> "No more than 3 copies of a single card by title can be included in
> any combination in a player's dynasty and conflict decks." *(RRG p. 7)*

> "A player's set of provinces must include exactly 5 provinces. For
> each element, that player must choose one province associated with
> that element, such that all five elements are represented among their
> set of provinces. (Each province has a ring symbol in the lower right
> corner of the card to indicate its association.) Each of these
> provinces must be in-clan or be neutral." *(RRG p. 7)*

> "No more than 1 copy of each province, by title, may be included in a
> player's set of provinces." *(RRG p. 7)*

> "Any additional deckbuilding restrictions contained in the separate
> Imperial Law document, based on the format being played, must be
> followed." *(RRG p. 7)*

### Skirmish format deckbuilding *(RRG p. 7)*:
> "Do not include stronghold, role, or province cards. A player's
> dynasty deck must contain a minimum of 30 cards and a maximum of 40
> cards. Each of these cards must be in-clan or neutral. A player's
> conflict deck must contain a minimum of 30 cards and a maximum of 40
> cards. Each of these cards must be in-clan or neutral, or be purchased
> from a single other clan by using influence. (Each player has 6
> influence with which to purchase out-of-clan cards during
> deckbuilding.) No more than 2 copies of a single card by title can be
> included in any combination in a player's dynasty and conflict decks.
> For tournament play, each player may include up to 10 additional
> cards in their 'sideboard'…" *(RRG p. 7)*

### Deck Limits *(RRG p. 7)*

> "Up to 3 total copies of most cards (by title) may be included in a
> player's dynasty and/or conflict decks (2 copies instead in skirmish
> format). Each copy of a card in either deck counts towards this
> limit. If a card has the text 'Limit X per deck' no more than X
> copies of that card may be included in that player's dynasty and/or
> conflict decks." *(RRG p. 7)*

If X is less than the standard number, it acts as a restriction; if X
is greater, it acts as a permission.

### Role-specific deckbuilding (not in RRG)

Specific role card effects (Keeper +3 influence, Support of [Clan] +8 and
forces splash) come from the **printed card text**, not the RRG. The RRG
defines roles structurally (p. 19) but defers their deckbuilding effects
to the cards themselves.

In our schema: `roleClassifier`, `roleRing`, `roleClan`, `influenceBonus`,
`forcesSplashClan` on Role cards. See `scripts/migrate-deck-validation-schema.ts`
for how these were backfilled.

---

## 11. tcgdb implementation cross-reference

| Concept | RRG | Schema field | Validator |
|---|---|---|---|
| Stronghold honor / fate / influence | p. 21 + anatomy p. 34 | `honor`, `fateIncome`, `influencePool` | — |
| Province element(s) | p. 17 | `elements: string[]` | `provinces.ts` |
| Character base skills | p. 4 | `military`, `political` (strings; preserve `—`) | — |
| Attachment skill modifiers | p. 3 | `militaryBonus`, `politicalBonus` | — |
| Role metadata | p. 19 | `roleClassifier`, `roleRing`, `roleClan`, `influenceBonus`, `forcesSplashClan` | `roleRestrictions.ts` (for "X role only" cards) |
| Card legality per format | p. 7 (Imperial Law) | `legalIn: { standard?, stronghold?, skirmish? }` | `legality.ts` |
| Deck-build copy override | p. 7 ("Limit X per deck") | `deckLimit: number` | `quantity.ts` |
| "X role only" text | p. 19 | `roleRestriction: { ring?, type?, clan? }` | `roleRestrictions.ts` |
| Deck splash clan | p. 7 ("single other clan") | `splashClan` on Deck | `clanLines.ts` |
| Deck shape | p. 7 | (zone counts) | `deckShape.ts` |
| Influence math | p. 12 | (sum of off-clan `influence` × qty ≤ pool) | `influence.ts` |
| Province element coverage | p. 7 | (multiset of `elements`) | `provinces.ts` |
| Composite validator | — | — | `src/games/l5r-lcg/validate.ts` |

---

## 12. Complete glossary

The full RRG glossary spans pages 2-25. **148 entries** were extracted by
`scripts/parse-rrg-glossary.py`; their raw bodies are in
`.tmp/rrg-glossary.json`. The list, alphabetical with page references:

- Ability *(p. 2)*
- Action, Action Ability *(p. 2)*
- Active Player *(p. 2)*
- Additional Conflicts *(p. 3)*
- Additional Cost *(p. 3)*
- Ancestral *(p. 3)*
- Attachment Cards *(p. 3)*
- Attacker, Attacking Character, Attacking Player *(p. 3)*
- Base Value *(p. 3)*
- Bid Value *(p. 3)*
- Blank *(p. 3)*
- Bow, Bowed *(p. 4)*
- Breaking a Province, Broken Province *(p. 4)*
- Cancel *(p. 4)*
- Cannot *(p. 4)*
- Cardtypes *(p. 4)*
- Challenge *(p. 4)*
- Character Cards *(p. 4)*
- Choose *(p. 4)*
- Clan *(p. 5)*
- Composure *(p. 5)*
- Conflict *(p. 5)*
- Conflicts at Multiple Provinces *(p. 5)*
- Constant Abilities *(p. 5)*
- Control and Ownership *(p. 5)*
- Copy (of a card) *(p. 6)*
- Corrupted *(p. 6)*
- Cost *(p. 6)*
- Count *(p. 6)*
- Courtesy *(p. 6)*
- Covert *(p. 6)*
- Current *(p. 6)*
- Dash (–) *(p. 7)*
- Deck Limits *(p. 7)*
- Deckbuilding *(p. 7)*
- Defender, Defending Character, Defending Player *(p. 7)*
- Delayed Effects *(p. 7)*
- Dire *(p. 8)*
- Discard Piles *(p. 8)*
- Disguised *(p. 8)*
- Dishonored, Dishonored Status Token *(p. 8)*
- Drawing cards *(p. 8)*
- Duel *(p. 8)*
- Duplicates *(p. 8)*
- Effects *(p. 8)*
- Eminent *(p. 9)*
- Enters Play *(p. 9)*
- Event Cards *(p. 9)*
- Facedown Province *(p. 9)*
- Fate *(p. 9)*
- Fill a Province *(p. 9)*
- First Player, First Player Token *(p. 10)*
- Forced (Forced Interrupts, Forced Reactions) *(p. 10)*
- Framework Effects and Framework Steps *(p. 10)*
- Gains *(p. 10)*
- Give *(p. 10)*
- Glory *(p. 10)*
- Glory Count *(p. 10)*
- Holding *(p. 11)*
- Home, Move Home *(p. 11)*
- Honor *(p. 11)*
- Honored, Honored Status Token *(p. 11)*
- Immune *(p. 11)*
- Imperial Favor, Imperial Favor Contest *(p. 11)*
- Influence, Influence Cost *(p. 12)*
- Interrupts *(p. 12)*
- Keywords *(p. 13)*
- Lasting Effects *(p. 13)*
- Leaves Play *(p. 13)*
- Limited *(p. 13)*
- Loses *(p. 14)*
- May *(p. 14)*
- Modifiers *(p. 14)*
- Move *(p. 14)*
- Mulligan *(p. 14)*
- Nested Ability Sequences *(p. 15)*
- Neutral *(p. 15)*
- Opponent *(p. 15)*
- Ordinary *(p. 15)*
- Own, Ownership *(p. 15)*
- Participating and Cannot Participate *(p. 15)*
- Pass *(p. 15)*
- Personal Honor, Personal Dishonor *(p. 16)*
- Play and Put into Play *(p. 16)*
- Play Restrictions and Permissions *(p. 16)*
- Player Elimination *(p. 16)*
- Pride *(p. 17)*
- Printed *(p. 17)*
- Priority of Simultaneous Resolution *(p. 17)*
- Provinces, Province Cards, Province Tokens *(p. 17)*
- Qualifiers *(p. 17)*
- Rally *(p. 17)*
- Reactions *(p. 17)*
- Ready *(p. 18)*
- Refill a Province *(p. 18)*
- Removed from Game *(p. 18)*
- Replacement Effects *(p. 18)*
- Resolve an Ability *(p. 18)*
- Restore a Province *(p. 18)*
- Restricted *(p. 18)*
- Reveal *(p. 18)*
- Rings *(p. 18)*
- Ring Effects *(p. 19)*
- Role Cards *(p. 19)*
- Running Out of Cards *(p. 19)*
- Sacrifice *(p. 19)*
- Search *(p. 19)*
- Select *(p. 20)*
- Self-referential Text *(p. 20)*
- Set *(p. 20)*
- Setup *(p. 20)*
- Shadowlands *(p. 20)*
- Shuffle *(p. 20)*
- Sincerity *(p. 20)*
- Skill *(p. 20)*
- Status Token *(p. 21)*
- Stronghold *(p. 21)*
- Support *(p. 21)*
- Switch *(p. 21)*
- Tainted, Tainted Status Token *(p. 21)*
- Take *(p. 21)*
- Target *(p. 22)*
- Token Pool, General Token Pool *(p. 22)*
- Traits *(p. 22)*
- Treaties *(p. 22)*
- Treaty Cards *(p. 23)*
- Triggered Abilities *(p. 23)*
- Triggering Condition *(p. 23)*
- Unique Cards *(p. 24)*
- Unopposed, Unopposed Conflict *(p. 24)*
- Winning a Conflict *(p. 24)*
- Winning the Game *(p. 24)*
- The word "Would" *(p. 25)*
- The letter "X" *(p. 25)*

For the full body text of each entry, see `.tmp/rrg-glossary.md` (generated
by `scripts/parse-rrg-glossary.py`) or pages 2-25 of the RRG PDF directly.

---

## 13. Practical guidance for Claude

When answering L5R rules/card questions:

1. **Anchor on the RRG.** Cite the page when making claims (e.g. "per RRG
   p. 19, Air ring lets the winner take 1 honor or gain 2"). If unsure,
   consult `docs/l5r-rules-reference-v17.pdf` or the extracted
   `.tmp/rules-text-columned.txt`.
2. **Card text overrides the RRG.** Per the Jade Rule *(p. 2)*, if a
   specific card's text contradicts the RRG, the card wins.
3. **The Imperial Law document is separate** and not bundled here. Per
   *(p. 7)* it contains format-specific restrictions (banned/restricted
   lists). When the user provides it, encode into `legalIn` per card.
4. **Schema fields may not yet capture every rule.** If asked about a
   rule whose state isn't in our schema (e.g. token state during play),
   say so — don't invent.
5. **Card-text rendering**: our scrape preserves `<b>/<i>/<em>/<br>`
   plus `[token]` symbols. Tokens render as literal strings in the UI
   (TODO: glyph rendering).
6. **Treaty / Warlord cards** are present in the catalog but marked
   not legal in Standard/Stronghold via `legalIn`. They are RRG-defined
   only for the Enlightenment (Clan War expansion) format.
7. **Never write rule statements from memory.** Source every claim from
   the RRG or another verifiable document. If a question requires
   information not present in our sources, say so and ask the user.
