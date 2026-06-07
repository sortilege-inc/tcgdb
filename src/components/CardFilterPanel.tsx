// L5R card filter panel — shared between the /games/l5r-lcg/cards/ browser
// and the deck editor's card-picker. Keeps the filter state shape, parsers,
// and UI consistent across both surfaces.

import * as React from 'react'

// =============================================================================
// Public types
// =============================================================================

/** Minimum card shape the filter knows how to evaluate. Templates can pass
 *  richer nodes; the panel ignores everything beyond this. */
export interface FilterableCard {
  cardId: string
  name: string
  /** ASCII-fied alternate name (e.g. "Wandering Ronin" alongside display "Wandering Rōnin").
   *  Optional. Used by the text-search haystack so cards are findable by either form. */
  nameAscii?: string | null
  type: string
  unique?: boolean | null
  text?: string | null
  clan?: string | null
  deck?: string | null
  faction?: string | null
  cost?: number | null
  // military / political are strings because their value depends on the
  // card's type. Characters carry a printed base skill ("3", "0", "—");
  // attachments carry a modifier in militaryBonus / politicalBonus instead.
  military?: string | null
  political?: string | null
  militaryBonus?: string | null
  politicalBonus?: string | null
  glory?: number | null
  strength?: number | null
  influence?: number | null
  element?: string | null
  /** Multi-element provinces (and Toshi Ranbo, the all-five wildcard) carry
   *  their element coverage here. Provinces filter through `elements`;
   *  the legacy `element` field is no longer populated. */
  elements?: string[] | null
  traits?: string[] | null
  /** ASCII-fied trait list. Used by the text-search haystack and as an
   *  alternate match key for the Traits picker (so "Yojimbo" finds "Yōjimbō"). */
  traitsAscii?: string[] | null
}

export type TriState = 'any' | 'yes' | 'no'
export type NumOp = '>' | '=' | '<'
export type NumericFilter = { op: NumOp; value: string }

export interface FilterState {
  query: string
  clans: Set<string>
  types: Set<string>
  decks: Set<string>            // 'dynasty' | 'conflict' | 'province'
  /** Province element filter — empty = any. Multi-element provinces match
   *  if ANY of their elements is in the set; Toshi Ranbo (all five) always
   *  matches when any element is picked. */
  elements: Set<string>
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

// =============================================================================
// Static lookups
// =============================================================================

export const CLANS = ['Crab', 'Crane', 'Dragon', 'Lion', 'Phoenix', 'Scorpion', 'Unicorn', 'Neutral'] as const
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

export const TYPES = ['Stronghold', 'Province', 'Role', 'Character', 'Attachment', 'Event', 'Holding', 'Warlord'] as const
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

export const DECK_SIDES = ['dynasty', 'conflict', 'province'] as const

export const ELEMENTS = ['air', 'earth', 'fire', 'water', 'void'] as const
const ELEMENT_GLYPH: Record<string, { abbr: string; color: string }> = {
  air:   { abbr: 'AI', color: '#a9c3d8' },
  earth: { abbr: 'EA', color: '#7c8a4a' },
  fire:  { abbr: 'FI', color: '#c25a3a' },
  water: { abbr: 'WA', color: '#4a8aa8' },
  void:  { abbr: 'VO', color: '#7a6aa0' },
}

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

export const DEFAULT_FILTERS: FilterState = {
  query: '',
  clans: new Set(),
  types: new Set(),
  decks: new Set(),
  elements: new Set(),
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

// =============================================================================
// Card-text parsers (graceful degradation: derive from text/traits)
// =============================================================================

/** Returns true if a card's text shows a trigger keyword. Handles the
 *  Forced-prefix variants without false-positive matching the base form. */
export function hasTrigger(text: string | null | undefined, trigger: string): boolean {
  if (!text) return false
  if (trigger === 'Action')    return /\bAction:/i.test(text)
  if (trigger === 'Reaction')  return /(?<!Forced\s)\bReaction:/i.test(text)
  if (trigger === 'Interrupt') return /(?<!Forced\s)\bInterrupt:/i.test(text)
  if (trigger === 'Forced Reaction')  return /\bForced Reaction\b/i.test(text)
  if (trigger === 'Forced Interrupt') return /\bForced Interrupt\b/i.test(text)
  return false
}

/** "Air role only.", "earth role only" etc. Also matches Keeper / Seeker role variants. */
export function getRoleRestriction(text: string | null | undefined): string | null {
  if (!text) return null
  const m = /\b(Air|Earth|Fire|Water|Void|Keeper|Seeker)\s+role\s+only\b/i.exec(text)
  return m ? m[1].toLowerCase() : null
}

/** Keyword presence — L5R keywords are usually a bare word + period at the start of a paragraph. */
export function hasKeyword(text: string | null | undefined, kw: string): boolean {
  if (!text || !kw) return false
  const re = new RegExp(`(^|\\n|\\s)${kw}\\.`, 'i')
  return re.test(text)
}

// =============================================================================
// Filter evaluation
// =============================================================================

function compareNum(
  cardValue: number | string | null | undefined,
  filter: NumericFilter,
): boolean {
  if (filter.value === '') return true
  if (cardValue === null || cardValue === undefined) return true
  // military/political come in as String to fit characters' base ("3", "—")
  // and attachments' bonus modifier (handled via militaryBonus). Parse here
  // so the numeric filter works for character skills. Non-numeric values
  // (dash, empty) silently degrade to "matches" so they aren't excluded.
  const numeric = typeof cardValue === 'number' ? cardValue : Number.parseInt(cardValue, 10)
  if (!Number.isFinite(numeric)) return true
  const target = Number(filter.value)
  if (!Number.isFinite(target)) return true
  if (filter.op === '>') return numeric > target
  if (filter.op === '<') return numeric < target
  return numeric === target
}

export function matchesFilters(card: FilterableCard, f: FilterState): boolean {
  if (f.query.trim()) {
    const q = f.query.trim().toLowerCase()
    // Include the ASCII variants so a query of "ronin" finds the card
    // displayed as "Rōnin", and "yojimbo" finds "Yōjimbō" in traits.
    const traitHay = (card.traits ?? []).join(' ')
    const traitAsciiHay = (card.traitsAscii ?? []).join(' ')
    const hay = [
      card.name,
      card.nameAscii ?? '',
      card.text ?? '',
      traitHay,
      traitAsciiHay,
    ].join('\n').toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (f.clans.size && !f.clans.has(card.clan ?? '')) return false
  if (f.types.size && !f.types.has(card.type)) return false
  if (f.decks.size) {
    const side =
      card.deck ??
      (card.type === 'Province' ? 'province' :
       card.type === 'Stronghold' || card.type === 'Role' ? '__skip' :
       '')
    if (side === '__skip') return false
    if (!f.decks.has(side)) return false
  }
  if (f.elements.size) {
    const cardElements = new Set((card.elements ?? []).map((e) => e.toLowerCase()))
    let any = false
    for (const e of f.elements) {
      if (cardElements.has(e)) { any = true; break }
    }
    if (!any) return false
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

export function isEmptyFilters(f: FilterState): boolean {
  return (
    f.query === '' &&
    f.clans.size === 0 &&
    f.types.size === 0 &&
    f.decks.size === 0 &&
    f.elements.size === 0 &&
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
// Panel + sub-components
// =============================================================================

export interface CardFilterPanelProps {
  open: boolean
  onToggle: () => void
  traits: string[]
  filters: FilterState
  onChange: (next: FilterState) => void
  /** Compact rendering for embedding inside the deck editor. */
  density?: 'comfortable' | 'compact'
}

export default function CardFilterPanel({
  open, onToggle, traits, filters, onChange, density = 'comfortable',
}: CardFilterPanelProps): React.ReactElement {
  const compact = density === 'compact'
  const update = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    onChange({ ...filters, [k]: v })
  const toggleInSet = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  return (
    <section
      style={{
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        borderRadius: 8,
        padding: compact ? '0.5rem 0.6rem' : '0.75rem 0.75rem',
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
            padding: '0.45rem 0.6rem',
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
            padding: '0.4rem 0.75rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
          }}
        >
          {open ? 'Hide filters' : 'Show filters'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.7rem' }}>
          {/* row: clan chips + 3 dropdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.6fr 1fr 1fr 1fr', gap: '0.6rem' }}>
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

          {/* row: type chips + 3 dropdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.6fr 1fr 1fr 1fr', gap: '0.6rem' }}>
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

          {/* row: deck-side buttons + 3 disabled toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.6fr 1fr 1fr 1fr', gap: '0.6rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {DECK_SIDES.map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => update('decks', toggleInSet(filters.decks, side))}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.5rem',
                    background: filters.decks.has(side) ? 'var(--theme-primary)' : 'var(--theme-surface-2)',
                    color: filters.decks.has(side) ? 'var(--theme-background)' : 'var(--theme-text)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: 6,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    fontSize: '0.75rem',
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

          {/* row: element chips (Province filter) */}
          <div>
            <div style={{ opacity: 0.6, fontSize: '0.7rem', marginBottom: '0.3rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Element <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0 }}>(Province)</span>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {ELEMENTS.map((el) => {
                const active = filters.elements.has(el)
                const meta = ELEMENT_GLYPH[el]!
                return (
                  <button
                    key={el}
                    type="button"
                    onClick={() => update('elements', toggleInSet(filters.elements, el))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.6rem',
                      background: active ? meta.color : 'var(--theme-surface-2)',
                      color: active ? '#fff' : 'var(--theme-text)',
                      border: `1px solid ${active ? meta.color : 'var(--theme-border)'}`,
                      borderRadius: 6,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: active ? 'rgba(255,255,255,0.25)' : meta.color,
                        color: active ? '#fff' : '#1a1a1a',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                      }}
                    >
                      {meta.abbr}
                    </span>
                    {el}
                  </button>
                )
              })}
            </div>
          </div>

          {/* numeric grid */}
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '0.4rem 1rem' }}>
            <NumericRow label="Cost"     value={filters.cost}      onChange={(v) => update('cost', v)} />
            <NumericRow label="Military" value={filters.military}  onChange={(v) => update('military', v)} />
            <NumericRow label="Political" value={filters.political} onChange={(v) => update('political', v)} />
            <NumericRow label="Glory"    value={filters.glory}     onChange={(v) => update('glory', v)} />
            <NumericRow label="Strength" value={filters.strength}  onChange={(v) => update('strength', v)} />
            <NumericRow label="Influence" value={filters.influence} onChange={(v) => update('influence', v)} />
          </div>

          <TraitPicker
            allTraits={traits}
            selected={filters.traits}
            onChange={(s) => update('traits', s)}
          />

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_FILTERS, traits: new Set(), elements: new Set() })}
              style={{
                background: '#b03a3a',
                color: '#fff',
                border: '1px solid #7a2929',
                borderRadius: 6,
                padding: '0.4rem 0.9rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontSize: '0.75rem',
              }}
            >
              Reset filters
            </button>
            <span style={{ opacity: 0.55, fontSize: '0.75rem', alignSelf: 'center' }}>
              Numeric, format, restricted/banned, and pack-legality controls await the next data pass.
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

// =============================================================================
// Internal sub-components
// =============================================================================

interface ChipRowItem { value: string; label: string; glyph: string; accent?: string }

function ChipRow({
  ariaLabel, items, selected, onToggle,
}: { ariaLabel: string; items: ChipRowItem[]; selected: Set<string>; onToggle: (v: string) => void }): React.ReactElement {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
      {items.map((it) => {
        const active = selected.has(it.value)
        return (
          <button
            key={it.value}
            type="button"
            title={it.label}
            onClick={() => onToggle(it.value)}
            style={{
              width: 30,
              height: 30,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: active ? (it.accent ?? 'var(--theme-primary)') : 'var(--theme-surface-2)',
              color: active ? '#fff' : 'var(--theme-text)',
              border: '1px solid var(--theme-border)',
              borderRadius: '50%',
              fontWeight: 700,
              fontSize: '0.78rem',
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
        gap: '0.18rem',
        opacity: disabled ? 0.45 : 1,
      }}
      title={disabled ? 'Awaiting data pass' : undefined}
    >
      <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '0.35rem 0.45rem',
          background: 'var(--theme-background)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-border)',
          borderRadius: 6,
          font: 'inherit',
          fontSize: '0.85rem',
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: 0.85 }}>
      <span style={{ width: '4.5rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>
        {label}
      </span>
      <div style={{ display: 'flex' }}>
        {ops.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => onChange({ ...value, op })}
            style={{
              width: 24,
              height: 26,
              padding: 0,
              background: value.op === op ? 'var(--theme-primary)' : 'var(--theme-surface-2)',
              color: value.op === op ? 'var(--theme-background)' : 'var(--theme-text)',
              border: '1px solid var(--theme-border)',
              borderRadius: 0,
              fontWeight: 700,
              fontSize: '0.8rem',
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
          width: '3.5rem',
          padding: '0.3rem 0.35rem',
          background: 'var(--theme-background)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-border)',
          borderRadius: 4,
          font: 'inherit',
          fontSize: '0.85rem',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            background: 'var(--theme-surface-2)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text)',
            borderRadius: 6,
            padding: '0.3rem 0.6rem',
            fontSize: '0.78rem',
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
              padding: '0.1rem 0.45rem',
              borderRadius: 999,
              fontSize: '0.72rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
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
              fontSize: '0.73rem',
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
            padding: '0.45rem',
            background: 'var(--theme-background)',
            maxHeight: 200,
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
              padding: '0.3rem 0.45rem',
              background: 'var(--theme-surface)',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-border)',
              borderRadius: 4,
              font: 'inherit',
              marginBottom: '0.4rem',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {matches.map((t) => {
              const active = selected.has(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(t)}
                  style={{
                    padding: '0.18rem 0.5rem',
                    fontSize: '0.75rem',
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
              <span style={{ opacity: 0.6, fontSize: '0.78rem' }}>No matching traits.</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
