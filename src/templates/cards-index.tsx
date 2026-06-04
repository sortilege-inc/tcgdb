import * as React from 'react'
import { graphql, Link, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'

// =============================================================================
// Types
// =============================================================================

interface PageContext {
  gameId: string
}

interface CardNode {
  cardId: string
  setId: string
  name: string
  type: string
  unique: boolean | null
  text: string | null
  clan: string | null
  deck: string | null
  faction: string | null
  cost: number | null
  military: number | null
  political: number | null
  glory: number | null
  strength: number | null
  influence: number | null
  element: string | null
  traits: string[] | null
}

interface SetNode {
  setId: string
  name: string
  cycle: string | null
  parentSetId: string | null
  type: string
}

interface Data {
  allCard: { nodes: CardNode[] }
  allCardSet: { nodes: SetNode[] }
}

// L5R-specific filter dimensions.
type TriState = 'any' | 'yes' | 'no'
type NumOp = '>' | '=' | '<'
type NumericFilter = { op: NumOp; value: string }

interface FilterState {
  query: string
  clans: Set<string>
  types: Set<string>
  decks: Set<string>            // 'dynasty' | 'conflict' | 'province'
  traits: Set<string>
  unique: TriState
  triggeredAbility: string      // '' = any
  roleRestriction: string       // '' = any
  keyword: string               // '' = any
  format: string                // '' = any (UI disabled for now)
  packLegality: TriState        // (UI disabled)
  showRestricted: TriState      // (UI disabled)
  showBanned: TriState          // (UI disabled)
  cost: NumericFilter
  military: NumericFilter
  political: NumericFilter
  glory: NumericFilter
  strength: NumericFilter
  influence: NumericFilter
}

type ViewMode = 'table' | 'grouped'

// =============================================================================
// Constants & static lookup tables
// =============================================================================

const CLANS = ['Crab', 'Crane', 'Dragon', 'Lion', 'Phoenix', 'Scorpion', 'Unicorn', 'Neutral']
// Single-letter abbreviation rendered into the chip. Color is the clan accent.
const CLAN_GLYPH: Record<string, { abbr: string; color: string }> = {
  Crab:     { abbr: 'CB', color: '#3a6cd0' },
  Crane:    { abbr: 'CR', color: '#5db3d6' },
  Dragon:   { abbr: 'DR', color: '#3fa86b' },
  Lion:     { abbr: 'LI', color: '#d4b14a' },
  Phoenix:  { abbr: 'PH', color: '#d36637' },
  Scorpion: { abbr: 'SC', color: '#b22e2e' },
  Unicorn:  { abbr: 'UN', color: '#7c4ec4' },
  Neutral:  { abbr: 'NU', color: '#888888' },
}

const TYPES = ['Stronghold', 'Province', 'Role', 'Character', 'Attachment', 'Event', 'Holding', 'Warlord']
const TYPE_GLYPH: Record<string, string> = {
  Stronghold: '🏯',
  Province: '🛡',
  Role: '◆',
  Character: '👤',
  Attachment: '🔗',
  Event: '⚡',
  Holding: '🏠',
  Warlord: '⚔',
}

const DECK_SIDES = ['dynasty', 'conflict', 'province'] as const

const TRIGGERS = [
  { value: '',                  label: 'Any' },
  { value: 'Action',            label: 'Action' },
  { value: 'Reaction',          label: 'Reaction' },
  { value: 'Interrupt',         label: 'Interrupt' },
  { value: 'Forced Reaction',   label: 'Forced Reaction' },
  { value: 'Forced Interrupt',  label: 'Forced Interrupt' },
]

const ROLES = [
  { value: '',        label: 'Any' },
  { value: 'air',     label: 'Air' },
  { value: 'earth',   label: 'Earth' },
  { value: 'fire',    label: 'Fire' },
  { value: 'water',   label: 'Water' },
  { value: 'void',    label: 'Void' },
  { value: 'keeper',  label: 'Keeper' },
  { value: 'seeker',  label: 'Seeker' },
]

const KEYWORDS = [
  { value: '',           label: 'Any' },
  { value: 'Pride',      label: 'Pride' },
  { value: 'Covert',     label: 'Covert' },
  { value: 'Sincerity',  label: 'Sincerity' },
  { value: 'Courtesy',   label: 'Courtesy' },
  { value: 'Restricted', label: 'Restricted' },
  { value: 'Limited',    label: 'Limited' },
  { value: 'Ancestral',  label: 'Ancestral' },
]

const DEFAULT_FILTERS: FilterState = {
  query: '',
  clans: new Set(),
  types: new Set(),
  decks: new Set(),
  traits: new Set(),
  unique: 'any',
  triggeredAbility: '',
  roleRestriction: '',
  keyword: '',
  format: '',
  packLegality: 'any',
  showRestricted: 'yes',
  showBanned: 'no',
  cost:      { op: '=', value: '' },
  military:  { op: '=', value: '' },
  political: { op: '=', value: '' },
  glory:     { op: '=', value: '' },
  strength:  { op: '=', value: '' },
  influence: { op: '=', value: '' },
}

const PAGE_SIZE = 50

// =============================================================================
// Card-text parsers (graceful degradation: derive from text/traits)
// =============================================================================

/** Returns true if a card's text shows a trigger keyword. Handles the
 *  Forced-prefix variants without false-positive matching the base form. */
function hasTrigger(text: string | null, trigger: string): boolean {
  if (!text) return false
  // Forced variants need to match exactly.
  if (trigger === 'Action')    return /\bAction:/i.test(text)
  if (trigger === 'Reaction')  return /(?<!Forced\s)\bReaction:/i.test(text)
  if (trigger === 'Interrupt') return /(?<!Forced\s)\bInterrupt:/i.test(text)
  if (trigger === 'Forced Reaction')  return /\bForced Reaction\b/i.test(text)
  if (trigger === 'Forced Interrupt') return /\bForced Interrupt\b/i.test(text)
  return false
}

/** "Air role only.", "earth role only" etc. Also matches Keeper / Seeker role variants. */
function getRoleRestriction(text: string | null): string | null {
  if (!text) return null
  const m = /\b(Air|Earth|Fire|Water|Void|Keeper|Seeker)\s+role\s+only\b/i.exec(text)
  return m ? m[1].toLowerCase() : null
}

/** Keyword presence — L5R keywords are usually a bare word + period at the start of a paragraph. */
function hasKeyword(text: string | null, kw: string): boolean {
  if (!text || !kw) return false
  // Look for "Keyword." as a token. Use word boundaries; many keywords are
  // also common English words (Pride / Limited / Restricted) so a strict
  // form-match avoids false positives in flavor sentences.
  const re = new RegExp(`(^|\\n|\\s)${kw}\\.`, 'i')
  return re.test(text)
}

// =============================================================================
// Filter evaluation
// =============================================================================

function compareNum(cardValue: number | null, filter: NumericFilter): boolean {
  // Graceful degradation: if no value entered, accept all (including missing).
  if (filter.value === '') return true
  // If we have a filter but no card data, accept (so the dataset isn't
  // empty in the months between schema work and the numeric pass).
  if (cardValue === null || cardValue === undefined) return true
  const target = Number(filter.value)
  if (!Number.isFinite(target)) return true
  if (filter.op === '>') return cardValue > target
  if (filter.op === '<') return cardValue < target
  return cardValue === target
}

function matchesFilters(card: CardNode, f: FilterState): boolean {
  // Text search (name + body text)
  if (f.query.trim()) {
    const q = f.query.trim().toLowerCase()
    const hay = `${card.name}\n${card.text ?? ''}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (f.clans.size && !f.clans.has(card.clan ?? '')) return false
  if (f.types.size && !f.types.has(card.type)) return false
  if (f.decks.size) {
    // Provinces have type=Province and no deck field; treat them as side 'province'.
    const side =
      card.deck ??
      (card.type === 'Province' ? 'province' :
       card.type === 'Stronghold' || card.type === 'Role' ? '__skip' :
       '')
    if (side === '__skip') {
      // strongholds/roles aren't dynasty/conflict/province; exclude when
      // the user has picked any side filter at all.
      return false
    }
    if (!f.decks.has(side)) return false
  }
  if (f.traits.size) {
    const cardTraits = new Set(card.traits ?? [])
    for (const t of f.traits) if (!cardTraits.has(t)) return false
  }
  if (f.unique === 'yes' && !card.unique) return false
  if (f.unique === 'no' && card.unique) return false
  if (f.triggeredAbility && !hasTrigger(card.text, f.triggeredAbility)) return false
  if (f.roleRestriction) {
    const r = getRoleRestriction(card.text)
    if (r !== f.roleRestriction) return false
  }
  if (f.keyword && !hasKeyword(card.text, f.keyword)) return false
  if (!compareNum(card.cost, f.cost)) return false
  if (!compareNum(card.military, f.military)) return false
  if (!compareNum(card.political, f.political)) return false
  if (!compareNum(card.glory, f.glory)) return false
  if (!compareNum(card.strength, f.strength)) return false
  if (!compareNum(card.influence, f.influence)) return false
  return true
}

function isEmptyFilters(f: FilterState): boolean {
  return (
    f.query === '' &&
    f.clans.size === 0 &&
    f.types.size === 0 &&
    f.decks.size === 0 &&
    f.traits.size === 0 &&
    f.unique === 'any' &&
    f.triggeredAbility === '' &&
    f.roleRestriction === '' &&
    f.keyword === '' &&
    f.cost.value === '' &&
    f.military.value === '' &&
    f.political.value === '' &&
    f.glory.value === '' &&
    f.strength.value === '' &&
    f.influence.value === ''
  )
}

// =============================================================================
// Page component
// =============================================================================

export default function CardsIndexPage(
  props: PageProps<Data, PageContext>
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const allCards = props.data.allCard.nodes
  const sets = props.data.allCardSet.nodes
  const setLookup = React.useMemo(
    () => Object.fromEntries(sets.map((s) => [s.setId, s] as const)),
    [sets]
  )

  // All distinct traits, alphabetized — for the trait multi-select.
  const allTraits = React.useMemo(() => {
    const s = new Set<string>()
    for (const c of allCards) for (const t of c.traits ?? []) s.add(t)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [allCards])

  const [filters, setFilters] = React.useState<FilterState>(DEFAULT_FILTERS)
  const [panelOpen, setPanelOpen] = React.useState(true)
  const [view, setView] = React.useState<ViewMode>('table')
  const [page, setPage] = React.useState(0)

  // Reset to page 0 whenever the filter changes.
  React.useEffect(() => { setPage(0) }, [filters])

  const filtered = React.useMemo(() => {
    return allCards.filter((c) => matchesFilters(c, filters))
  }, [allCards, filters])

  return (
    <>
      <header style={{ marginBottom: '1rem' }}>
        <Link to={`/games/${gameId}/`} style={{ opacity: 0.7 }}>
          ← {game?.shortName ?? game?.name ?? gameId}
        </Link>
        <h1 style={{ marginTop: '0.5rem' }}>Cards</h1>
        <p style={{ opacity: 0.7 }}>
          {allCards.length.toLocaleString()} card{allCards.length === 1 ? '' : 's'} across{' '}
          {sets.length} set{sets.length === 1 ? '' : 's'}.
          {!isEmptyFilters(filters) && (
            <> <strong>{filtered.length.toLocaleString()}</strong> match current filters.</>
          )}
        </p>
      </header>

      <FilterPanel
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        traits={allTraits}
        filters={filters}
        onChange={setFilters}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          margin: '1.25rem 0 0.75rem',
        }}
      >
        <ViewToggle view={view} onChange={setView} />
        <span style={{ flex: 1 }} />
        <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>
          {filtered.length.toLocaleString()} result{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p style={{ opacity: 0.7, padding: '2rem 0' }}>No cards match the current filters.</p>
      ) : view === 'table' ? (
        <ResultsTable
          gameId={gameId}
          cards={filtered}
          page={page}
          onPageChange={setPage}
        />
      ) : (
        <GroupedView gameId={gameId} cards={filtered} setLookup={setLookup} />
      )}
    </>
  )
}

// =============================================================================
// FilterPanel
// =============================================================================

interface FilterPanelProps {
  open: boolean
  onToggle: () => void
  traits: string[]
  filters: FilterState
  onChange: (next: FilterState) => void
}

function FilterPanel({ open, onToggle, traits, filters, onChange }: FilterPanelProps): React.ReactElement {
  const update = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    onChange({ ...filters, [k]: v })

  const toggleInSet = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  // Search input + show/hide button stay visible even when the panel is collapsed.
  return (
    <section
      style={{
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        borderRadius: 8,
        padding: '0.75rem 0.75rem',
      }}
    >
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="search"
          value={filters.query}
          onChange={(e) => update('query', e.target.value)}
          placeholder="Search for card name, ability text, artist…"
          style={{
            flex: 1,
            padding: '0.55rem 0.75rem',
            background: 'var(--theme-background)',
            color: 'var(--theme-text)',
            border: '1px solid var(--theme-border)',
            borderRadius: 6,
            font: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{
            background: 'var(--theme-primary)',
            color: 'var(--theme-background)',
            border: '1px solid var(--theme-border)',
            borderRadius: 6,
            padding: '0.5rem 0.85rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontSize: '0.8rem',
            whiteSpace: 'nowrap',
          }}
        >
          {open ? 'Hide filters' : 'Show filters'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.85rem' }}>
          {/* Row: clan chips + selector dropdowns row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: '0.75rem' }}>
            <ChipRow
              ariaLabel="Clan"
              items={CLANS.map((c) => ({
                value: c,
                label: c,
                glyph: CLAN_GLYPH[c]?.abbr ?? c.slice(0, 2),
                accent: CLAN_GLYPH[c]?.color ?? 'var(--theme-primary)',
              }))}
              selected={filters.clans}
              onToggle={(v) => update('clans', toggleInSet(filters.clans, v))}
            />
            <SelectField label="Traits" value="" onChange={() => {}} disabled>
              <option>—</option>
            </SelectField>
            <SelectField
              label="Triggered Ability"
              value={filters.triggeredAbility}
              onChange={(v) => update('triggeredAbility', v)}
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </SelectField>
            <SelectField label="Keyword" value={filters.keyword} onChange={(v) => update('keyword', v)}>
              {KEYWORDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </SelectField>
          </div>

          {/* Row: type chips + selector dropdowns row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: '0.75rem' }}>
            <ChipRow
              ariaLabel="Type"
              items={TYPES.map((t) => ({ value: t, label: t, glyph: TYPE_GLYPH[t] ?? t.slice(0, 2) }))}
              selected={filters.types}
              onToggle={(v) => update('types', toggleInSet(filters.types, v))}
            />
            <SelectField label="Is Unique" value={filters.unique} onChange={(v) => update('unique', v as TriState)}>
              <option value="any">Either</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </SelectField>
            <SelectField
              label="Role Restriction"
              value={filters.roleRestriction}
              onChange={(v) => update('roleRestriction', v)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </SelectField>
            <SelectField label="Choose a format" value="" onChange={() => {}} disabled>
              <option>—</option>
            </SelectField>
          </div>

          {/* Row: deck-side buttons + 3 disabled toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {DECK_SIDES.map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => update('decks', toggleInSet(filters.decks, side))}
                  style={{
                    flex: 1,
                    padding: '0.55rem 0.5rem',
                    background: filters.decks.has(side) ? 'var(--theme-primary)' : 'var(--theme-surface-2)',
                    color: filters.decks.has(side) ? 'var(--theme-background)' : 'var(--theme-text)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: 6,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {side}
                </button>
              ))}
            </div>
            <SelectField label="Pack Legality" value="" onChange={() => {}} disabled>
              <option>—</option>
            </SelectField>
            <SelectField label="Show Restricted Cards" value="" onChange={() => {}} disabled>
              <option>—</option>
            </SelectField>
            <SelectField label="Show Banned Cards" value="" onChange={() => {}} disabled>
              <option>—</option>
            </SelectField>
          </div>

          {/* Row: numeric filters laid out in two halves */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem 1rem' }}>
            <NumericRow label="Cost"     value={filters.cost}      onChange={(v) => update('cost', v)} />
            <NumericRow label="Military" value={filters.military}  onChange={(v) => update('military', v)} />
            <NumericRow label="Political" value={filters.political} onChange={(v) => update('political', v)} />
            <NumericRow label="Glory"    value={filters.glory}     onChange={(v) => update('glory', v)} />
            <NumericRow label="Strength" value={filters.strength}  onChange={(v) => update('strength', v)} />
            <NumericRow label="Influence" value={filters.influence} onChange={(v) => update('influence', v)} />
          </div>

          {/* Traits chooser — collapsed by default, expands to show many */}
          <TraitPicker
            allTraits={traits}
            selected={filters.traits}
            onChange={(s) => update('traits', s)}
          />

          {/* Action bar */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_FILTERS, traits: new Set() })}
              style={{
                background: '#b03a3a',
                color: '#fff',
                border: '1px solid #7a2929',
                borderRadius: 6,
                padding: '0.5rem 1rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontSize: '0.8rem',
              }}
            >
              Reset filters
            </button>
            <span style={{ opacity: 0.55, fontSize: '0.78rem', alignSelf: 'center' }}>
              Numeric filters, format / restricted / banned, and pack-legality controls
              await the next data pass — they display but don&apos;t filter yet.
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

// -----------------------------------------------------------------------------
// FilterPanel sub-components
// -----------------------------------------------------------------------------

interface ChipRowItem { value: string; label: string; glyph: string; accent?: string }

function ChipRow({
  ariaLabel, items, selected, onToggle,
}: { ariaLabel: string; items: ChipRowItem[]; selected: Set<string>; onToggle: (v: string) => void }): React.ReactElement {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
      {items.map((it) => {
        const active = selected.has(it.value)
        return (
          <button
            key={it.value}
            type="button"
            title={it.label}
            onClick={() => onToggle(it.value)}
            style={{
              width: 34,
              height: 34,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: active ? (it.accent ?? 'var(--theme-primary)') : 'var(--theme-surface-2)',
              color: active ? '#fff' : 'var(--theme-text)',
              border: '1px solid var(--theme-border)',
              borderRadius: '50%',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {it.glyph}
          </button>
        )
      })}
    </div>
  )
}

function SelectField({
  label, value, onChange, disabled, children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  children: React.ReactNode
}): React.ReactElement {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
        opacity: disabled ? 0.45 : 1,
      }}
      title={disabled ? 'Awaiting data pass' : undefined}
    >
      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '0.45rem 0.55rem',
          background: 'var(--theme-background)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-border)',
          borderRadius: 6,
          font: 'inherit',
        }}
      >
        {children}
      </select>
    </label>
  )
}

function NumericRow({
  label, value, onChange,
}: { label: string; value: NumericFilter; onChange: (v: NumericFilter) => void }): React.ReactElement {
  const ops: NumOp[] = ['>', '=', '<']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: 0.85 }}>
      <span style={{ width: '5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>
        {label}
      </span>
      <div style={{ display: 'flex' }}>
        {ops.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => onChange({ ...value, op })}
            style={{
              width: 26,
              height: 28,
              padding: 0,
              background: value.op === op ? 'var(--theme-primary)' : 'var(--theme-surface-2)',
              color: value.op === op ? 'var(--theme-background)' : 'var(--theme-text)',
              border: '1px solid var(--theme-border)',
              borderRadius: 0,
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {op}
          </button>
        ))}
      </div>
      <input
        type="number"
        inputMode="numeric"
        value={value.value}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
        style={{
          width: '4rem',
          padding: '0.35rem 0.4rem',
          background: 'var(--theme-background)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-border)',
          borderRadius: 4,
          font: 'inherit',
        }}
      />
    </div>
  )
}

function TraitPicker({
  allTraits, selected, onChange,
}: { allTraits: string[]; selected: Set<string>; onChange: (s: Set<string>) => void }): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const matches = React.useMemo(() => {
    if (!query.trim()) return allTraits
    const q = query.trim().toLowerCase()
    return allTraits.filter((t) => t.toLowerCase().includes(q))
  }, [allTraits, query])
  const toggle = (t: string) => {
    const next = new Set(selected)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    onChange(next)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            background: 'var(--theme-surface-2)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text)',
            borderRadius: 6,
            padding: '0.35rem 0.65rem',
            fontSize: '0.8rem',
          }}
        >
          Traits ({selected.size}) {open ? '▾' : '▸'}
        </button>
        {Array.from(selected).sort().map((t) => (
          <span
            key={t}
            style={{
              background: 'var(--theme-primary)',
              color: 'var(--theme-background)',
              padding: '0.15rem 0.5rem',
              borderRadius: 999,
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            {t}
            <button
              type="button"
              onClick={() => toggle(t)}
              aria-label={`Remove ${t}`}
              style={{
                background: 'transparent',
                color: 'inherit',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ×
            </button>
          </span>
        ))}
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => onChange(new Set())}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--theme-text-muted)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            clear traits
          </button>
        )}
      </div>
      {open && (
        <div
          style={{
            border: '1px solid var(--theme-border)',
            borderRadius: 6,
            padding: '0.5rem',
            background: 'var(--theme-background)',
            maxHeight: 220,
            overflow: 'auto',
          }}
        >
          <input
            type="search"
            placeholder="Filter traits…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem',
              background: 'var(--theme-surface)',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-border)',
              borderRadius: 4,
              font: 'inherit',
              marginBottom: '0.5rem',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {matches.map((t) => {
              const active = selected.has(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(t)}
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.78rem',
                    background: active ? 'var(--theme-primary)' : 'var(--theme-surface-2)',
                    color: active ? 'var(--theme-background)' : 'var(--theme-text)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: 999,
                    cursor: 'pointer',
                  }}
                >
                  {t}
                </button>
              )
            })}
            {matches.length === 0 && (
              <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>No matching traits.</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Results: table view + grouped view + view toggle
// =============================================================================

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }): React.ReactElement {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--theme-border)', borderRadius: 6, overflow: 'hidden' }}>
      {(['table', 'grouped'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            background: v === view ? 'var(--theme-primary)' : 'var(--theme-surface-2)',
            color: v === view ? 'var(--theme-background)' : 'var(--theme-text)',
            border: 'none',
            padding: '0.4rem 0.85rem',
            fontSize: '0.82rem',
            textTransform: 'capitalize',
            cursor: 'pointer',
          }}
        >
          {v === 'table' ? 'Table view' : 'Grouped view'}
        </button>
      ))}
    </div>
  )
}

function ResultsTable({
  gameId, cards, page, onPageChange,
}: { gameId: string; cards: CardNode[]; page: number; onPageChange: (n: number) => void }): React.ReactElement {
  const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE))
  const clampedPage = Math.min(page, pages - 1)
  const slice = cards.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE)

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.88rem',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--theme-border)', textAlign: 'left' }}>
              <Th>Name</Th>
              <Th>Traits</Th>
              <Th>Type</Th>
              <Th>Faction</Th>
              <Th>Deck</Th>
              <Th align="right">Cost</Th>
              <Th align="right">Mil</Th>
              <Th align="right">Pol</Th>
              <Th align="right">Glory</Th>
              <Th align="right">Str</Th>
            </tr>
          </thead>
          <tbody>
            {slice.map((c) => (
              <tr key={c.cardId} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                <Td>
                  <Link to={`/games/${gameId}/cards/${c.cardId}/`}>{c.name}</Link>
                  {c.unique && (
                    <span title="Unique" style={{ marginLeft: '0.35rem', opacity: 0.55, fontSize: '0.7rem' }}>◆</span>
                  )}
                </Td>
                <Td muted small>
                  {c.traits?.length ? (
                    <em style={{ fontStyle: 'italic' }}>{c.traits.join('. ')}.</em>
                  ) : '—'}
                </Td>
                <Td>{c.type}</Td>
                <Td muted>{c.clan ?? c.faction ?? '—'}</Td>
                <Td muted>{c.deck ?? '—'}</Td>
                <Td align="right" muted>{c.cost ?? '—'}</Td>
                <Td align="right" muted>{c.military ?? '—'}</Td>
                <Td align="right" muted>{c.political ?? '—'}</Td>
                <Td align="right" muted>{c.glory ?? '—'}</Td>
                <Td align="right" muted>{c.strength ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={clampedPage}
        pages={pages}
        totalRows={cards.length}
        pageSize={PAGE_SIZE}
        onPageChange={onPageChange}
      />
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }): React.ReactElement {
  return (
    <th
      style={{
        padding: '0.45rem 0.6rem',
        fontWeight: 600,
        fontSize: '0.78rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        opacity: 0.65,
        textAlign: align ?? 'left',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children, align, muted, small,
}: { children: React.ReactNode; align?: 'left' | 'right'; muted?: boolean; small?: boolean }): React.ReactElement {
  return (
    <td
      style={{
        padding: '0.45rem 0.6rem',
        textAlign: align ?? 'left',
        opacity: muted ? 0.85 : 1,
        fontSize: small ? '0.8rem' : '0.88rem',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  )
}

function Pagination({
  page, pages, totalRows, pageSize, onPageChange,
}: { page: number; pages: number; totalRows: number; pageSize: number; onPageChange: (n: number) => void }): React.ReactElement {
  const first = page * pageSize + 1
  const last = Math.min(totalRows, (page + 1) * pageSize)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        padding: '0.6rem 0',
        fontSize: '0.82rem',
      }}
    >
      <span style={{ opacity: 0.7 }}>
        {first.toLocaleString()}–{last.toLocaleString()} of {totalRows.toLocaleString()}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        style={{ padding: '0.25rem 0.55rem', fontSize: '0.82rem', opacity: page === 0 ? 0.4 : 1 }}
      >
        ‹ Prev
      </button>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pages - 1, page + 1))}
        disabled={page >= pages - 1}
        style={{ padding: '0.25rem 0.55rem', fontSize: '0.82rem', opacity: page >= pages - 1 ? 0.4 : 1 }}
      >
        Next ›
      </button>
    </div>
  )
}

function GroupedView({
  gameId, cards, setLookup,
}: { gameId: string; cards: CardNode[]; setLookup: Record<string, SetNode> }): React.ReactElement {
  const grouped = React.useMemo(() => {
    const bySet = new Map<string, CardNode[]>()
    for (const c of cards) {
      const list = bySet.get(c.setId) ?? []
      list.push(c)
      bySet.set(c.setId, list)
    }
    return Array.from(bySet.entries()).sort(([a], [b]) => {
      const an = setLookup[a]?.name ?? a
      const bn = setLookup[b]?.name ?? b
      return an.localeCompare(bn)
    })
  }, [cards, setLookup])
  return (
    <div>
      {grouped.map(([setId, list]) => {
        const set = setLookup[setId]
        return (
          <section key={setId} style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: '0.4rem' }}>
              <Link to={`/games/${gameId}/sets/${setId}/`}>{set?.name ?? setId}</Link>{' '}
              <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.85rem' }}>
                ({list.length})
              </span>
            </h2>
            <ul style={{ listStyle: 'none' }}>
              {list.map((c) => (
                <li
                  key={c.cardId}
                  style={{
                    padding: '0.25rem 0',
                    borderBottom: '1px solid var(--theme-border)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: '0.75rem',
                    alignItems: 'baseline',
                  }}
                >
                  <Link to={`/games/${gameId}/cards/${c.cardId}/`}>{c.name}</Link>
                  <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{c.type}</span>
                  <span style={{ opacity: 0.6, fontSize: '0.8rem', minWidth: '5rem', textAlign: 'right' }}>
                    {c.clan ?? c.faction ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// =============================================================================
// GraphQL page query + Head
// =============================================================================

export const Head: HeadFC<Data, PageContext> = ({ pageContext }) => {
  const game = getGame(pageContext.gameId)
  return <title>{game ? `Cards · ${game.shortName ?? game.name} · tcgdb` : 'Cards · tcgdb'}</title>
}

export const query = graphql`
  query CardsIndex($gameId: String!) {
    allCard(filter: { gameId: { eq: $gameId } }, sort: { name: ASC }) {
      nodes {
        cardId
        setId
        name
        type
        unique
        text
        clan
        deck
        faction
        cost
        military
        political
        glory
        strength
        influence
        element
        traits
      }
    }
    allCardSet(filter: { gameId: { eq: $gameId } }) {
      nodes {
        setId
        name
        cycle
        parentSetId
        type
      }
    }
  }
`
