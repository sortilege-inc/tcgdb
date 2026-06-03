# NetrunnerDB — Site Specification Document

---

## 1. Overview & Purpose

NetrunnerDB is a community-driven card database and deckbuilder for the Android: Netrunner trading card game. Its core functions are: browsing/searching individual cards, building and publishing decklists, and discovering other players' published decks. It is maintained by the community organisation Null Signal Games and powered by a public API.

---

## 2. Visual Design & Theming

### Color Scheme
- Default theme: Dark mode. Background is near-black (`~#111`), with off-white body text.
- A light/dark mode toggle is available in the top-right navbar (moon icon).
- Accent colors are faction-coded: Anarch = orange-red, Criminal = blue, Shaper = green, Haas-Bioroid = purple, Jinteki = red, NBN = yellow/gold, Weyland = dark green.

### Typography
- Sans-serif body font throughout. Card titles and headings are slightly larger/bolder.
- Card ability text uses a mix of regular text and inline `monospace/code` styling for specific game terminology.
- Flavor text in the card body is italicized.

### Iconography
- Faction icons are small SVG/image icons displayed inline next to faction names throughout the site (in nav links, card detail pages, decklist headers).
- Game symbols (credits, clicks, MU, trash) are rendered as inline images or special Unicode-adjacent glyphs embedded throughout card text.
- Influence dots (e.g. `●●●○○`) appear as colored dot icons next to influence cost.
- Badges for legality status use colored pill buttons: green "LEGAL", gray/orange "LOADING", etc.

### Layout
- Fixed top navigation bar spanning the full width.
- Content is centered in a container with generous side margins on wide screens.
- Most pages use a **two-column layout**: main content left (~65%) and a sidebar right (~35%). Some pages (card detail, decklist view) use a three-panel layout.
- Responsive / mobile-optimised.

### Decorative Elements
- The home page has a subtle gradient header/banner strip at the very top above the navbar using warm brown tones, suggesting a thematic border.

---

## 3. Navigation

### Top Navigation Bar

**Left side (left-to-right):**
- **Logo** — Site wordmark "NetrunnerDB" with a small icon; links to homepage.
- **My Decks** — Direct link (requires auth).
- **Decklists ▾** — Dropdown with: Search, Popular, Recent, Decklists of the Week, Tournaments, Hot Topics, Hall of Fame, (divider), My Decklists, My Favorites.
- **Sets** — Direct link to the card set index.
- **Factions ▾** — Dropdown split into two groups: *Runner* (Anarch, Criminal, Shaper, Mini-factions) and *Corp* (Haas-Bioroid, Jinteki, NBN, Weyland Consortium).
- **More ▾** — Dropdown with: Play Formats, Ban Lists, Rotation, Reviews, Rules Text Updates, Rulings, Illustrators, Print & Play, New Search ✨.

**Right side:**
- **Card Search 🔍** — Inline search bar that expands on click.
- **Syntax** — Link to search syntax reference docs.
- **Advanced** — Link to the full Advanced Search form.
- **User menu 👤 ▾** — Login/Register or account actions.
- **Dark mode toggle 🌙**

### Sub-navigation (Home page only)
A second horizontal bar below the top nav displays faction quick-links as colored icon+label tabs:

> Anarch | Criminal | Shaper | Haas-Bioroid | Jinteki | NBN | Weyland

---

## 4. Pages & Page Specifications

### 4.1 Homepage (`/`)

**Layout:** Two-column.

#### Left column — "Decklist of the Week"
- Section heading in faction accent color.
- Decklist title as a large linked heading.
- Identity card thumbnail (portrait orientation, ~200×300px).
- Identity name + sub-identity label, faction badge.
- Deck stats: influence spent, agenda points, card count, card pool used.
- Deck contents listed by category (Agenda, Asset, Operation, ICE sub-types, etc.), each category with a count in parentheses. Cards are hyperlinked. Influence pips displayed inline as colored dots.
- A free-text description/write-up by the author below the card list (long-form, supports bullet points and inline card links).
- An embedded collapsible "NetrunnerDB Updates" changelog widget.

#### Right column — "Last 10 Decklists"
- Heading with a "more" link.
- List of 10 recent decklist cards, each containing:
  - Identity card thumbnail (small, ~60×80px).
  - Decklist title (link).
  - Set/card pool name (e.g. "Vantage Point").
  - Username + reputation score (numeric).
  - Tournament/event badge (green pill with event name).

---

### 4.2 Card Search Results (`/find/`)

**URL pattern:** `/find/?q={query}&sort={sort}&view={view}`

**Layout:** Single-column with a filter bar at top.

#### Filter bar
- Text input: "Card Search".
- "Search" button.
- Sort dropdown: Sort by Name, Sort by Set Name, Sort by Faction, etc.
- View dropdown: Images only, Checklist, Full, Spoiler, Text.
- A banner tip: *"Try the ✨ New Search ✨ for more powerful search options."*

#### Results area
- Card image grid (when view = images), or a text list/checklist depending on view mode.
- Empty state: A highlighted warning box with message and link to the syntax reference.

> **Note:** Two search systems co-exist. The old search uses text field with operand-based syntax. The New Search is linked prominently and offers enhanced features.

---

### 4.3 Advanced Search (`/en/search`)

**Layout:** Single-column form, full width.

#### Form sections
- **Title and texts:** Title (text input), Text (textarea), Flavor Text (textarea).
- **Faction and side:** Side dropdown (Either/Runner/Corp), Faction multi-select dropdown.
- **Attributes:** Set dropdown, Type dropdown, Unique dropdown, Subtype dropdown.
- **Numerics:** Cost, Influence, Strength, Quantity — each with an operator dropdown (`=`, `≥`, `≤`, `>`, `<`) and a value input.
- **Card pools & Ban Lists:** Rotation dropdown, Ban List dropdown.
- **Other:** Previews dropdown, Illustrator dropdown.
- **Submit:** Sort-by dropdown, View-as dropdown, Search button.

---

### 4.4 Search Syntax Reference (`/en/syntax`)

**Layout:** Single-column, documentation-style.

Collapsible sections (Show/Hide toggle):
- Introduction prose.
- **Syntax:** Accepted operands, Accepted operators, Some examples, Card aliases.
- **Operands:** Detailed breakdown of each search field code.

---

### 4.5 Card Detail Page (`/en/card/{id}`)

**Layout:** Three-column.

#### Left column — Card image
- Full-size card art image (~300×420px portrait).
- Navigation arrows: `← Previous Card` | `Set Name` | `Next Card →` at top.

#### Center column — Card data
- Card name (large, with a `◆` prefix for unique cards).
- Cost/strength value (top right of the panel).
- Type line (e.g. "Hardware: Console").
- Faction icon + influence pip display.
- Ability text (with special symbol icons for clicks, credits, etc.; italic for flavor/reminder text).
- Illustrator credit as a linked byline.
- "Decklists with this card" link.

#### Right column — Metadata
- Set name + card number in set + language badge (e.g. "English").
- Card pool legality: Three pill badges (Startup Card Pool, Standard Card Pool, Eternal Card Pool) with status: LEGAL (green), BANNED (red), LOADING (gray).
- "Show history" link for legality changes.
- **Printings** section: lists alternate versions/printings of the card.

#### Below three-column area

**Rulings section**
- Lists official rulings, or *"No rulings yet for this card."*

**Reviews section**
- User-submitted long-form reviews. Each review shows:
  - ❤️ upvote count.
  - Rich text body (supports inline card links, bullet lists, monospace code blocks).
  - Date posted, set era label, username + reputation score.
  - Horizontal rule separators between reviews.

---

### 4.6 Sets Index (`/en/sets`)

**Layout:** Single-column table.

**Columns:** Name | Cards | Release Date | Standard (✓) | Startup (✓) | Eternal (✓)

- Rows are grouped by cycle/expansion, with sub-items (packs within a cycle) indented using a `↳` prefix.
- Cycle rows act as parent headers; pack rows are children.
- Each set name is a link.
- Checkmarks indicate which card pools include the set.

---

### 4.7 Decklist Search (`/en/decklists/find`)

**Layout:** Left sidebar + main content area.

#### Left sidebar navigation
Search | Popular | Recent | Decklists of the Week | Tournaments | Hot Topics | Hall of Fame | My Decklists | My Favorites

#### Main area — Filter form
- Side or Faction (dropdown)
- Author name (text input)
- Cards used (card title text input)
- Decklist name (text input)
- Sort (dropdown: by Popularity, by Date, etc.)
- Tournament Legal (dropdown)
- Rotation (dropdown)
- Legality (dropdown)
- Filter by card pool: Startup | Standard | NSG | All | None quick-links; "Show card packs" toggle
- Search button

#### Results list
- Pagination: numbered page links with `◀`/`▶` arrows.
- Each result row contains:
  - Identity thumbnail image (small).
  - Decklist title (link).
  - Username + reputation score.
  - Tournament/event badge (green pill).
  - Rotation label.
  - Social metrics: ❤️ favorites | ★ stars | 💬 comments.
  - Date posted.

---

### 4.8 Decklist Detail Page (`/en/decklist/{uuid}/{slug}`)

**Layout:** Two-column.

#### Left column — Deck view
- Faction icon + Decklist title (large heading).
- Meta row: Date | ❤️ favorites | ★ stars | 💬 comments | Copy legacy URL link.
- Tab bar: **Decklist** | Packs | Info | Actions ▾.
- Identity thumbnail + Identity name + sub-identity label.
- Deck stats: influence spent (with max), card count (with min), card pool.
- Tournament badge (colored pill).
- Card list grouped by type category (Event, Hardware, Resource, Icebreaker, Program, ICE sub-types, etc.), each with a count header. Cards listed as `{qty}x {Card Name}` with influence pip icons. Card names are hyperlinked.
- Legality section: ban list status label.
- Rotation section: rotation label.

#### Right column — Author & description
- Username + reputation score (linked).
- Free-form description/write-up (long-form, supports paragraphs, lists, bold, italic, inline card links).

---

### 4.9 About Page (`/en/about`)

Static informational page containing:
- Site description.
- **Code of Conduct:** Care, Consideration, Tone, NSFW, Deck of the Week, Moderation, Governance.
- Pronunciation notes.

---

### 4.10 Error / 404 Page

Minimal centered layout. Displays:

> *"Sorry. I tried very hard, but I couldn't find what you're looking for. And that's pretty much it."*

---

## 5. User Accounts & Authentication

- Login/Register accessible via the user icon (👤 ▾) in the top navbar.
- Authenticated users can: save decks ("My Decks"), favorite decklists, publish decklists, write reviews.
- User profiles display a username and a numeric reputation score (e.g. "Tanzzen 118").

---

## 6. Data Model (Key Entities)

### Card
| Field | Type |
|---|---|
| ID | string |
| Title | string |
| Faction | enum |
| Side | enum (Runner / Corp) |
| Type | enum |
| Subtype(s) | string |
| Cost | integer |
| Influence cost | integer |
| Strength | integer |
| Quantity per deck | integer |
| Card text | rich text |
| Flavor text | string |
| Illustrator | string |
| Set / Pack | reference |
| Card number | integer |
| Unique flag | boolean |
| Legality per pool | enum (Legal / Banned / Restricted) |
| Image URL | string |
| Printings | list of references |

### Set / Pack
| Field | Type |
|---|---|
| Name | string |
| Cycle parent | reference |
| Card count | integer |
| Release date | date |
| Standard legal | boolean |
| Startup legal | boolean |
| Eternal legal | boolean |

### Faction
| Field | Type |
|---|---|
| Code | string (e.g. "anarch") |
| Name | string |
| Side | enum (Runner / Corp) |
| Color | hex string |
| Icon | image URL |

### Decklist
| Field | Type |
|---|---|
| UUID | string |
| Slug | string |
| Title | string |
| Identity card | reference |
| Card list | list of (card ID, quantity) pairs |
| Author | user reference |
| Date published | date |
| Description | rich text |
| Tournament badge | string |
| Rotation | string |
| Legality status | string |
| Favorites count | integer |
| Stars count | integer |
| Comments count | integer |

### User
| Field | Type |
|---|---|
| Username | string |
| Reputation score | integer |

### Review
| Field | Type |
|---|---|
| Card ID | reference |
| Author | user reference |
| Body | rich text |
| Date | date |
| Era label | string |
| Upvote count | integer |

---

## 7. Search System

Two search systems co-exist:

### Legacy Card Search (query string syntax)
- Field-based operators, e.g. `f:anarch`, `t:icebreaker`, `x:credit`, `s:vantage-point`.
- Pipe `|` acts as OR operator.
- Conditions with spaces must be quoted.
- Results can be sorted and viewed in multiple formats (images, checklist, full, text, spoiler).

### New Search ✨ (enhanced)
- Promoted throughout the site.
- Faster, more powerful, with a new URL structure.

### Advanced Search (form-based)
- GUI form that generates equivalent queries without needing to know syntax.

---

## 8. Key UI Components

**Card Thumbnail** — Small portrait card image with subtle border, used in lists and sidebars.

**Identity Block** — Card image + identity name + sub-name + faction + deck stats summary. Used on homepage and decklist pages.

**Deck Card List** — Cards grouped by type. Each group has a heading like "Asset (13)" with the type icon. Cards listed as `{qty}x {Name} {influence pips}`. Card names are links to card detail pages.

**Social Metrics Row** — `❤️ {n} | ★ {n} | 💬 {n}` displayed inline, used on decklist rows and headers.

**Tournament/Event Badge** — Small green pill label with event name (e.g. "2026 Megacity Championship"), sometimes with a rotation icon.

**Legality Pill** — Colored badge (green = LEGAL, red = BANNED, gray = LOADING/unknown).

**Faction Tabs** — Horizontal row of icon+label tabs for each playable faction, used on homepage.

**Collapsible Panel** — Clickable heading row with a "Show/Hide" button that reveals content below.

**Pagination** — Numbered pages with `◀`/`▶` arrows. Used on decklist search results.

**Cookie Banner** — Fixed bottom bar with Learn More link and a yellow "Got it!" dismiss button.

**Dark Mode Toggle** — Moon icon in navbar; persists across sessions.

---

## 9. Footer

- Left-aligned links: About | API | Integration | Donators 🎁 | Clear data
- Attribution text (original creator + Null Signal Games)
- Ko-Fi support link
- Copyright disclaimer (FFG / Null Signal Games)
- Flag icon on the right (locale switcher)

---

## 10. API & Integration

- A public REST API is available (`/api/`), enabling third-party apps to query card data, decklists, etc.
- An Integration page documents usage.
- The site is open source; bug reports and feature requests are managed on GitHub.

---

## 11. Notable UX Patterns

- Card names throughout the site (in reviews, decklists, descriptions) are consistently hyperlinked to their card detail pages.
- The "Decklist of the Week" on the homepage is both a community showcase and an editorial quality signal.
- Inline game symbols (credits, clicks, trash) are rendered visually rather than as plain text, maintaining authenticity to the physical card game.
- "My Decks" vs "Decklists" is a deliberate distinction: private/draft decks vs. published public decklists.
- The site supports multiple card pool rotations (Startup, Standard, Eternal, NSG), and nearly every piece of content is tagged with its legal card pool.
- Navigation encourages discovery: the Factions dropdown links directly to faction-filtered card views; the Decklists dropdown exposes curated lists (Popular, Tournaments, Hall of Fame) alongside user-personal lists.
