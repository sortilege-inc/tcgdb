import * as React from 'react'
import { graphql, Link, navigate, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'
import { getGameModule } from '../games/registry'
import { useDeck, useSidecarState } from '../state/SidecarStateProvider'
import { useConflictReporter } from '../state/ConflictReporter'
import type { Card, Deck, Format } from '../types/data'
import type { CardLookup, ValidationResult } from '../games/_types'
import CardFilterPanel, {
  DEFAULT_FILTERS,
  matchesFilters,
  type FilterState,
} from '../components/CardFilterPanel'

interface PageContext {
  gameId: string
}

interface CardNode {
  cardId: string
  gameId: string
  setId: string
  publisherId: string
  name: string
  nameAscii: string | null
  type: string
  unique: boolean | null
  text: string | null
  flavorText: string | null
  illustrator: string | null
  clan: string | null
  deck: string | null
  faction: string | null
  side: string | null
  cost: number | null
  military: string | null
  political: string | null
  militaryBonus: string | null
  politicalBonus: string | null
  glory: number | null
  strength: number | null
  influence: number | null
  influencePool: number | null
  element: string | null
  traits: string[] | null
  traitsAscii: string[] | null
}

interface Data {
  allCard: { nodes: CardNode[] }
}

// L5R format requirements. Pulled from the official rules; kept on hand because
// game.deckZones doesn't currently encode cardLimit ranges.
const L5R_REQS = {
  stronghold:  { strongholds: 1, roles: 1, provinces: 5 },
  dynasty:     { min: 40, max: 45 },
  conflict:    { min: 40, max: 45 },
} as const

type SortMode = 'cost' | 'name'

export default function DeckDetailPage(
  props: PageProps<Data, PageContext> & { params?: Record<string, string> }
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const module = getGameModule(gameId)

  const deckId = React.useMemo(() => {
    if (props.params?.deckId) return props.params.deckId
    if (typeof window !== 'undefined') {
      const m = /\/games\/[^/]+\/decks\/([^/]+)\/?$/.exec(window.location.pathname)
      if (m) return m[1]
    }
    return undefined
  }, [props.params?.deckId])

  const deck = useDeck(gameId, deckId)
  const { patchDeck, deleteDeck, readOnly, loading } = useSidecarState()
  const { reportIfConflict } = useConflictReporter()

  const allCards = props.data.allCard.nodes
  const cardById = React.useMemo(() => {
    const m = new Map<string, CardNode>()
    for (const c of allCards) m.set(c.cardId, c)
    return m
  }, [allCards])

  const cardLookup: CardLookup = React.useMemo(() => {
    return {
      get: (id: string) => cardById.get(id) as Card | undefined,
      getMany: (ids: string[]) =>
        ids.map((id) => cardById.get(id)).filter((c): c is CardNode => !!c) as unknown as Card[],
    }
  }, [cardById])

  if (loading && !deck) {
    return <p style={{ opacity: 0.6 }}>Loading deck…</p>
  }
  if (!deckId) {
    return (
      <>
        <h1>No deck specified</h1>
        <p><Link to={`/games/${gameId}/decks/`}>Back to decks.</Link></p>
      </>
    )
  }
  if (!deck) {
    return (
      <>
        <h1>Deck not found</h1>
        <p>
          No deck with id <code>{deckId}</code> in <code>{gameId}</code>.{' '}
          <Link to={`/games/${gameId}/decks/`}>Back to decks.</Link>
        </p>
      </>
    )
  }
  if (!game) return <p>Unknown game.</p>

  const liveDeck: Deck = deck

  const format: Format = game.formats.find((f) => f.id === liveDeck.formatId) ?? {
    id: liveDeck.formatId, name: liveDeck.formatId,
  }

  const validation: ValidationResult | null = module
    ? module.validate({ deck: liveDeck, format, lookup: cardLookup })
    : null

  const cardNames = React.useMemo(
    () => Object.fromEntries(allCards.map((c) => [c.cardId, c.name])),
    [allCards]
  )

  async function onPatch(patch: Partial<Deck>): Promise<void> {
    if (readOnly) return
    try {
      await patchDeck(gameId, liveDeck.id, patch as Parameters<typeof patchDeck>[2])
    } catch (err: unknown) {
      const handled = reportIfConflict(err, {
        gameId,
        title:
          patch.built === true
            ? `Cannot mark "${liveDeck.name}" as built`
            : `That change can't be saved while "${liveDeck.name}" is built`,
        description:
          'The built-deck invariant guarantees every physically-sleeved card is actually available in your collection.',
        cardNames,
      })
      if (!handled) {
        alert(`Failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  async function onDelete(): Promise<void> {
    if (readOnly) return
    if (!window.confirm(`Delete "${liveDeck.name}"? This cannot be undone.`)) return
    try {
      await deleteDeck(gameId, liveDeck.id)
      void navigate(`/games/${gameId}/decks/`)
    } catch (err: unknown) {
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Card → zone mapping (which zone receives a + click).
  function zoneForCard(c: CardNode): string | null {
    if (c.type === 'Stronghold' || c.type === 'Role' || c.type === 'Province') return 'stronghold'
    if (c.deck === 'dynasty') return 'dynasty'
    if (c.deck === 'conflict') return 'conflict'
    return null
  }

  function adjustQty(cardId: string, delta: number): void {
    const card = cardById.get(cardId)
    if (!card) return
    const zoneId = zoneForCard(card)
    if (!zoneId) return
    const entries = liveDeck.zones[zoneId] ?? []
    const current = entries.find((e) => e.cardId === cardId)?.qty ?? 0
    const next = Math.max(0, current + delta)
    const nextEntries =
      next === 0
        ? entries.filter((e) => e.cardId !== cardId)
        : entries.some((e) => e.cardId === cardId)
          ? entries.map((e) => (e.cardId === cardId ? { ...e, qty: next } : e))
          : [...entries, { cardId, qty: next }]
    void onPatch({ zones: { ...liveDeck.zones, [zoneId]: nextEntries } })
  }

  function qtyOf(cardId: string): number {
    for (const zone of Object.values(liveDeck.zones)) {
      const e = zone.find((x) => x.cardId === cardId)
      if (e) return e.qty
    }
    return 0
  }

  return (
    <>
      <header style={{ marginBottom: '1rem' }}>
        <Link to={`/games/${gameId}/decks/`} style={{ opacity: 0.7 }}>← Decks</Link>
        <h1 style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          <InlineEditText
            value={liveDeck.name}
            onCommit={(v) => onPatch({ name: v })}
            disabled={readOnly}
            ariaLabel="deck name"
          />
          <span
            style={{
              padding: '0.18rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'var(--theme-surface)',
              border: '1px solid var(--theme-border)',
              borderRadius: 999,
              opacity: 0.85,
            }}
          >
            {format.name}
          </span>
          {liveDeck.built && (
            <span
              style={{
                padding: '0.18rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'rgba(39, 174, 96, 0.25)',
                border: '1px solid rgba(39, 174, 96, 0.5)',
                borderRadius: 999,
              }}
            >
              Built
            </span>
          )}
        </h1>
        <div style={{ opacity: 0.7, display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.85rem' }}>
          <span>origin: {liveDeck.origin}</span>
          {liveDeck.importedFrom && <span style={{ opacity: 0.6 }}>from {liveDeck.importedFrom}</span>}
          <span>updated {liveDeck.updatedAt.slice(0, 16).replace('T', ' ')}</span>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        <DeckSidebar
          gameId={gameId}
          deck={liveDeck}
          cardById={cardById}
          validation={validation}
          readOnly={readOnly}
          onPatch={onPatch}
          onDelete={onDelete}
          onAdjustQty={adjustQty}
        />
        <CardPicker
          gameId={gameId}
          allCards={allCards}
          qtyOf={qtyOf}
          onAdjustQty={adjustQty}
          disabled={readOnly}
        />
      </div>
    </>
  )
}

// =============================================================================
// Deck sidebar
// =============================================================================

interface DeckSidebarProps {
  gameId: string
  deck: Deck
  cardById: Map<string, CardNode>
  validation: ValidationResult | null
  readOnly: boolean
  onPatch: (patch: Partial<Deck>) => Promise<void>
  onDelete: () => Promise<void>
  onAdjustQty: (cardId: string, delta: number) => void
}

function DeckSidebar({
  gameId, deck, cardById, validation, readOnly, onPatch, onDelete, onAdjustQty,
}: DeckSidebarProps): React.ReactElement {
  const [tab, setTab] = React.useState<'overview' | 'description' | 'statistics' | 'settings'>('overview')
  const [sortMode, setSortMode] = React.useState<SortMode>('cost')

  // Resolve the entries in each zone with card data, organized by sub-category.
  const buckets = React.useMemo(() => {
    function resolve(entries: { cardId: string; qty: number }[]) {
      return entries
        .map((e) => ({ entry: e, card: cardById.get(e.cardId) }))
        .filter((x): x is { entry: { cardId: string; qty: number }; card: CardNode } => !!x.card)
    }
    function sort(list: { entry: { cardId: string; qty: number }; card: CardNode }[]) {
      return list.slice().sort((a, b) => {
        if (sortMode === 'cost') {
          const ac = a.card.cost ?? Infinity
          const bc = b.card.cost ?? Infinity
          if (ac !== bc) return ac - bc
        }
        return a.card.name.localeCompare(b.card.name)
      })
    }
    const sh = resolve(deck.zones['stronghold'] ?? [])
    const dyn = resolve(deck.zones['dynasty'] ?? [])
    const cf = resolve(deck.zones['conflict'] ?? [])
    return {
      stronghold: {
        stronghold: sort(sh.filter(({ card }) => card.type === 'Stronghold')),
        role: sort(sh.filter(({ card }) => card.type === 'Role')),
        provinces: sort(sh.filter(({ card }) => card.type === 'Province')),
      },
      dynasty: {
        characters: sort(dyn.filter(({ card }) => card.type === 'Character')),
        holdings: sort(dyn.filter(({ card }) => card.type === 'Holding')),
        events: sort(dyn.filter(({ card }) => card.type === 'Event')),
        other: sort(dyn.filter(({ card }) =>
          card.type !== 'Character' && card.type !== 'Holding' && card.type !== 'Event'
        )),
      },
      conflict: {
        characters: sort(cf.filter(({ card }) => card.type === 'Character')),
        attachments: sort(cf.filter(({ card }) => card.type === 'Attachment')),
        events: sort(cf.filter(({ card }) => card.type === 'Event')),
        other: sort(cf.filter(({ card }) =>
          card.type !== 'Character' && card.type !== 'Attachment' && card.type !== 'Event'
        )),
      },
    }
  }, [deck, cardById, sortMode])

  const counts = {
    strongholds: buckets.stronghold.stronghold.reduce((n, x) => n + x.entry.qty, 0),
    roles:       buckets.stronghold.role.reduce((n, x) => n + x.entry.qty, 0),
    provinces:   buckets.stronghold.provinces.reduce((n, x) => n + x.entry.qty, 0),
    dynasty: Object.values(buckets.dynasty).flat().reduce((n, x) => n + x.entry.qty, 0),
    conflict: Object.values(buckets.conflict).flat().reduce((n, x) => n + x.entry.qty, 0),
  }
  const dynastyBreakdown = buckets.dynasty
  const conflictBreakdown = buckets.conflict
  const dynBreakdownCounts = {
    Characters: dynastyBreakdown.characters.reduce((n, x) => n + x.entry.qty, 0),
    Holdings: dynastyBreakdown.holdings.reduce((n, x) => n + x.entry.qty, 0),
    Events: dynastyBreakdown.events.reduce((n, x) => n + x.entry.qty, 0),
  }
  const cfBreakdownCounts = {
    Characters: conflictBreakdown.characters.reduce((n, x) => n + x.entry.qty, 0),
    Attachments: conflictBreakdown.attachments.reduce((n, x) => n + x.entry.qty, 0),
    Events: conflictBreakdown.events.reduce((n, x) => n + x.entry.qty, 0),
  }

  // Influence: sum of (cost ?? 0) for conflict cards whose clan != stronghold clan.
  // For now no card has cost data so this will be 0 for everyone.
  const strongholdCard = buckets.stronghold.stronghold[0]?.card
  const shClan = strongholdCard?.clan ?? null
  const influenceUsed = Object.values(buckets.conflict).flat().reduce((n, x) => {
    if (!shClan) return n
    if (x.card.clan && x.card.clan !== shClan && x.card.clan !== 'Neutral') {
      return n + (x.card.influence ?? 0) * x.entry.qty
    }
    return n
  }, 0)
  const influencePool = strongholdCard?.influencePool ?? null

  return (
    <aside
      style={{
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        borderRadius: 8,
        padding: '0.75rem 0.9rem',
        position: 'sticky',
        top: '0.5rem',
        maxHeight: 'calc(100vh - 1rem)',
        overflowY: 'auto',
        fontSize: '0.88rem',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.3rem',
          marginBottom: '0.75rem',
          borderBottom: '1px solid var(--theme-border)',
        }}
      >
        {(['overview', 'description', 'statistics', 'settings'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--theme-primary)' : '2px solid transparent',
              color: tab === t ? 'var(--theme-text)' : 'var(--theme-text-muted)',
              padding: '0.4rem 0.6rem',
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Validation summary */}
      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div
          style={{
            background: 'var(--theme-background)',
            border: '1px solid var(--theme-border)',
            borderLeft: '4px solid var(--theme-primary)',
            borderRadius: 6,
            padding: '0.5rem 0.65rem',
            marginBottom: '0.75rem',
            fontSize: '0.78rem',
          }}
        >
          {validation.errors.map((e, i) => (
            <div key={`e${i}`} style={{ color: '#e8755a' }}>⚠ {e.message}</div>
          ))}
          {validation.warnings.map((w, i) => (
            <div key={`w${i}`} style={{ opacity: 0.85 }}>◦ {w.message}</div>
          ))}
        </div>
      )}

      {tab === 'overview' && (
        <>
          {/* Format requirements blurb */}
          <p style={{ opacity: 0.65, fontSize: '0.75rem', marginBottom: '0.8rem' }}>
            Dynasty deck: {L5R_REQS.dynasty.min}–{L5R_REQS.dynasty.max} cards.{' '}
            Conflict deck: {L5R_REQS.conflict.min}–{L5R_REQS.conflict.max} cards.{' '}
            Exactly {L5R_REQS.stronghold.provinces} provinces, {L5R_REQS.stronghold.strongholds} stronghold,{' '}
            {L5R_REQS.stronghold.roles} role.
          </p>

          {/* Stronghold zone — strongholds + role + provinces */}
          <ZoneSection
            title="Stronghold"
            counts={[
              { label: 'stronghold', n: counts.strongholds, target: L5R_REQS.stronghold.strongholds },
              { label: 'role',       n: counts.roles,       target: L5R_REQS.stronghold.roles },
              { label: 'provinces',  n: counts.provinces,   target: L5R_REQS.stronghold.provinces },
            ]}
            sortMode={sortMode}
            onSortMode={setSortMode}
          >
            <SubCategory title="Stronghold" entries={buckets.stronghold.stronghold} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
            <SubCategory title="Role" entries={buckets.stronghold.role} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
            <SubCategory title="Provinces" entries={buckets.stronghold.provinces} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
          </ZoneSection>

          {/* Dynasty zone */}
          <ZoneSection
            title={`Dynasty cards (${counts.dynasty})`}
            counts={[{ label: 'min', n: counts.dynasty, target: L5R_REQS.dynasty.min, allowRange: L5R_REQS.dynasty.max }]}
            breakdown={dynBreakdownCounts}
            sortMode={sortMode}
            onSortMode={setSortMode}
          >
            <SubCategory title="Characters" entries={dynastyBreakdown.characters} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
            <SubCategory title="Holdings" entries={dynastyBreakdown.holdings} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
            <SubCategory title="Events" entries={dynastyBreakdown.events} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
            {dynastyBreakdown.other.length > 0 && (
              <SubCategory title="Other" entries={dynastyBreakdown.other} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
            )}
          </ZoneSection>

          {/* Influence counter */}
          <div
            style={{
              fontSize: '0.78rem',
              opacity: 0.85,
              marginBottom: '0.75rem',
            }}
          >
            Influence:{' '}
            <strong>{influenceUsed}</strong>
            {' / '}
            <strong>{influencePool ?? '—'}</strong>
            {!influencePool && (
              <span style={{ opacity: 0.55, marginLeft: '0.35rem' }}>
                (stronghold influence pool unknown until numeric data lands)
              </span>
            )}
          </div>

          {/* Conflict zone */}
          <ZoneSection
            title={`Conflict cards (${counts.conflict})`}
            counts={[{ label: 'min', n: counts.conflict, target: L5R_REQS.conflict.min, allowRange: L5R_REQS.conflict.max }]}
            breakdown={cfBreakdownCounts}
            sortMode={sortMode}
            onSortMode={setSortMode}
          >
            <SubCategory title="Characters" entries={conflictBreakdown.characters} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
            <SubCategory title="Attachments" entries={conflictBreakdown.attachments} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
            <SubCategory title="Events" entries={conflictBreakdown.events} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
            {conflictBreakdown.other.length > 0 && (
              <SubCategory title="Other" entries={conflictBreakdown.other} gameId={gameId} onAdjust={onAdjustQty} disabled={readOnly} />
            )}
          </ZoneSection>
        </>
      )}

      {tab === 'description' && (
        <NotesEditor
          initial={deck.notes ?? ''}
          onCommit={(v) => onPatch({ notes: v })}
          disabled={readOnly}
        />
      )}

      {tab === 'statistics' && (
        <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>
          Cost curves and clan-mix charts land once numeric stat data is populated.
        </p>
      )}

      {tab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={deck.built}
              onChange={(e) => onPatch({ built: e.target.checked })}
              disabled={readOnly}
            />
            Built (physically sleeved)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={deck.enforceErrata}
              onChange={(e) => onPatch({ enforceErrata: e.target.checked })}
              disabled={readOnly}
            />
            Enforce errata
          </label>
          <button
            type="button"
            onClick={onDelete}
            disabled={readOnly}
            style={{
              marginTop: '0.65rem',
              background: 'transparent',
              border: '1px solid rgba(192, 57, 43, 0.6)',
              color: '#e8755a',
              padding: '0.35rem 0.65rem',
              borderRadius: 4,
            }}
          >
            Delete deck
          </button>
        </div>
      )}
    </aside>
  )
}

interface ZoneSectionProps {
  title: string
  counts: { label: string; n: number; target: number; allowRange?: number }[]
  breakdown?: Record<string, number>
  sortMode: SortMode
  onSortMode: (m: SortMode) => void
  children: React.ReactNode
}

function ZoneSection({ title, counts, breakdown, sortMode, onSortMode, children }: ZoneSectionProps): React.ReactElement {
  return (
    <section style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85, marginBottom: '0.35rem' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.35rem' }}>
        {counts.map((c) => {
          const ok = c.allowRange
            ? c.n >= c.target && c.n <= c.allowRange
            : c.n === c.target
          return (
            <span
              key={c.label}
              style={{
                padding: '0.1rem 0.45rem',
                fontSize: '0.7rem',
                borderRadius: 999,
                background: ok ? 'rgba(39, 174, 96, 0.2)' : 'rgba(192, 57, 43, 0.18)',
                border: `1px solid ${ok ? 'rgba(39, 174, 96, 0.5)' : 'rgba(192, 57, 43, 0.4)'}`,
              }}
              title={`${c.label}: ${c.n}/${c.allowRange ? `${c.target}-${c.allowRange}` : c.target}`}
            >
              {c.label}: <strong>{c.n}</strong>/{c.allowRange ? `${c.target}-${c.allowRange}` : c.target}
            </span>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
        <button
          type="button"
          onClick={() => onSortMode('cost')}
          style={sortChipStyle(sortMode === 'cost')}
        >
          Sort by Cost
        </button>
        <button
          type="button"
          onClick={() => onSortMode('name')}
          style={sortChipStyle(sortMode === 'name')}
        >
          Sort by Name
        </button>
        {breakdown && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem', fontSize: '0.7rem', opacity: 0.65 }}>
            {Object.entries(breakdown).map(([k, n]) => (
              <span key={k}>{k} ({n})</span>
            ))}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

function sortChipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--theme-primary)' : 'transparent',
    color: active ? 'var(--theme-background)' : 'var(--theme-text-muted)',
    border: '1px solid var(--theme-border)',
    borderRadius: 4,
    padding: '0.15rem 0.45rem',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    cursor: 'pointer',
  }
}

interface SubCategoryProps {
  title: string
  entries: { entry: { cardId: string; qty: number }; card: CardNode }[]
  gameId: string
  onAdjust: (cardId: string, delta: number) => void
  disabled?: boolean
}

function SubCategory({ title, entries, gameId, onAdjust, disabled }: SubCategoryProps): React.ReactElement | null {
  if (entries.length === 0) return null
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ fontSize: '0.72rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>
        {title} ({entries.reduce((n, x) => n + x.entry.qty, 0)})
      </div>
      <ul style={{ listStyle: 'none' }}>
        {entries.map(({ entry, card }) => (
          <li
            key={entry.cardId}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto auto auto',
              gap: '0.35rem',
              alignItems: 'center',
              padding: '0.18rem 0',
              borderBottom: '1px solid var(--theme-border)',
              fontSize: '0.82rem',
            }}
          >
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85, width: '1.5rem' }}>
              {entry.qty}×
            </span>
            <Link to={`/games/${gameId}/cards/${entry.cardId}/`} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {card.name}
            </Link>
            {card.cost != null ? (
              <span style={{ opacity: 0.5, fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{card.cost}</span>
            ) : <span />}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAdjust(entry.cardId, -1)}
              aria-label="Decrement"
              style={{ padding: '0 0.4rem', fontSize: '0.8rem' }}
            >
              −
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAdjust(entry.cardId, +1)}
              aria-label="Increment"
              style={{ padding: '0 0.4rem', fontSize: '0.8rem' }}
            >
              +
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// =============================================================================
// Card picker (right column)
// =============================================================================

const PICKER_PAGE_SIZE = 25

function CardPicker({
  gameId, allCards, qtyOf, onAdjustQty, disabled,
}: {
  gameId: string
  allCards: CardNode[]
  qtyOf: (cardId: string) => number
  onAdjustQty: (cardId: string, delta: number) => void
  disabled?: boolean
}): React.ReactElement {
  const [filters, setFilters] = React.useState<FilterState>(DEFAULT_FILTERS)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [page, setPage] = React.useState(0)
  const traits = React.useMemo(() => {
    const s = new Set<string>()
    for (const c of allCards) for (const t of c.traits ?? []) s.add(t)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [allCards])

  React.useEffect(() => { setPage(0) }, [filters])

  const filtered = React.useMemo(
    () => allCards.filter((c) => matchesFilters(c, filters)),
    [allCards, filters]
  )

  const pages = Math.max(1, Math.ceil(filtered.length / PICKER_PAGE_SIZE))
  const clampedPage = Math.min(page, pages - 1)
  const slice = filtered.slice(clampedPage * PICKER_PAGE_SIZE, (clampedPage + 1) * PICKER_PAGE_SIZE)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <CardFilterPanel
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        traits={traits}
        filters={filters}
        onChange={setFilters}
        density="compact"
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ flex: 1 }} />
        <span style={{ opacity: 0.6, fontSize: '0.82rem' }}>
          {filtered.length.toLocaleString()} match
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--theme-border)', textAlign: 'left' }}>
              <th style={thStyle}>Qty</th>
              <th style={thStyle}>Card</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
              <th style={thStyle}>Traits</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((c) => {
              const q = qtyOf(c.cardId)
              return (
                <tr key={c.cardId} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                  <td style={{ padding: '0.35rem 0.5rem', verticalAlign: 'middle' }}>
                    <QtyStepper
                      qty={q}
                      onDecrement={() => onAdjustQty(c.cardId, -1)}
                      onIncrement={() => onAdjustQty(c.cardId, +1)}
                      disabled={disabled}
                    />
                  </td>
                  <td style={{ padding: '0.35rem 0.5rem' }}>
                    <Link to={`/games/${gameId}/cards/${c.cardId}/`}>{c.name}</Link>
                    <span style={{ opacity: 0.55, marginLeft: '0.4rem', fontSize: '0.75rem' }}>
                      {c.type}{c.clan ? ` · ${c.clan}` : ''}
                    </span>
                  </td>
                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>
                    {c.cost ?? '—'}
                  </td>
                  <td style={{ padding: '0.35rem 0.5rem', opacity: 0.75, fontSize: '0.78rem', fontStyle: 'italic' }}>
                    {c.traits?.length ? c.traits.join('. ') + '.' : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <PickerPagination
        page={clampedPage}
        pages={pages}
        totalRows={filtered.length}
        pageSize={PICKER_PAGE_SIZE}
        onPageChange={setPage}
      />
    </section>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.4rem 0.5rem',
  fontWeight: 600,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  opacity: 0.65,
}

function QtyStepper({
  qty, onDecrement, onIncrement, disabled,
}: { qty: number; onDecrement: () => void; onIncrement: () => void; disabled?: boolean }): React.ReactElement {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0, border: '1px solid var(--theme-border)', borderRadius: 4, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onDecrement}
        disabled={disabled || qty === 0}
        aria-label="Decrement"
        style={{
          padding: '0.1rem 0.45rem',
          background: 'var(--theme-surface-2)',
          border: 'none',
          color: 'var(--theme-text)',
          opacity: qty === 0 ? 0.35 : 1,
          cursor: qty === 0 || disabled ? 'default' : 'pointer',
        }}
      >−</button>
      <span style={{ minWidth: '1.5rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem', padding: '0 0.2rem' }}>
        {qty}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={disabled}
        aria-label="Increment"
        style={{
          padding: '0.1rem 0.45rem',
          background: 'var(--theme-primary)',
          border: 'none',
          color: 'var(--theme-background)',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >+</button>
    </div>
  )
}

function PickerPagination({
  page, pages, totalRows, pageSize, onPageChange,
}: { page: number; pages: number; totalRows: number; pageSize: number; onPageChange: (n: number) => void }): React.ReactElement {
  const first = page * pageSize + 1
  const last = Math.min(totalRows, (page + 1) * pageSize)
  if (totalRows === 0) return <></>
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', fontSize: '0.78rem' }}>
      <span style={{ opacity: 0.6 }}>
        {first.toLocaleString()}–{last.toLocaleString()} of {totalRows.toLocaleString()}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        style={{ padding: '0.18rem 0.45rem', fontSize: '0.78rem', opacity: page === 0 ? 0.4 : 1 }}
      >
        ‹ Prev
      </button>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pages - 1, page + 1))}
        disabled={page >= pages - 1}
        style={{ padding: '0.18rem 0.45rem', fontSize: '0.78rem', opacity: page >= pages - 1 ? 0.4 : 1 }}
      >
        Next ›
      </button>
    </div>
  )
}

// =============================================================================
// Inline-edit text + notes editor
// =============================================================================

function InlineEditText({
  value, onCommit, disabled, ariaLabel,
}: { value: string; onCommit: (v: string) => void; disabled?: boolean; ariaLabel: string }): React.ReactElement {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => { setDraft(value) }, [value])

  if (!editing) {
    return (
      <span
        onClick={() => !disabled && setEditing(true)}
        style={{ cursor: disabled ? 'default' : 'text', borderBottom: disabled ? 'none' : '1px dotted var(--theme-border)' }}
        title={disabled ? '' : 'Click to rename'}
      >
        {value}
      </span>
    )
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false)
        if (draft.trim() && draft !== value) onCommit(draft.trim())
        else setDraft(value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') { setDraft(value); setEditing(false) }
      }}
      aria-label={ariaLabel}
      style={{
        font: 'inherit',
        background: 'var(--theme-surface)',
        color: 'var(--theme-text)',
        border: '1px solid var(--theme-border)',
        borderRadius: 4,
        padding: '0.1rem 0.3rem',
        width: '100%',
        maxWidth: '32rem',
      }}
    />
  )
}

function NotesEditor({
  initial, onCommit, disabled,
}: { initial: string; onCommit: (v: string) => void; disabled?: boolean }): React.ReactElement {
  const [value, setValue] = React.useState(initial)
  React.useEffect(() => { setValue(initial) }, [initial])
  const dirty = value !== initial

  return (
    <>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        disabled={disabled}
        placeholder="Plan, matchups, write-up…"
        style={{
          width: '100%',
          padding: '0.55rem 0.65rem',
          background: 'var(--theme-background)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-border)',
          borderRadius: 6,
          fontFamily: 'inherit',
          font: 'inherit',
          resize: 'vertical',
          fontSize: '0.85rem',
        }}
      />
      <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onCommit(value)}
          disabled={!dirty || disabled}
          style={{
            background: dirty ? 'var(--theme-primary)' : 'var(--theme-surface)',
            color: dirty ? 'var(--theme-background)' : 'var(--theme-text)',
            border: dirty ? 'none' : '1px solid var(--theme-border)',
            padding: '0.3rem 0.7rem',
            fontSize: '0.82rem',
          }}
        >
          Save
        </button>
        {dirty && <span style={{ opacity: 0.6, fontSize: '0.78rem' }}>unsaved</span>}
      </div>
    </>
  )
}

// =============================================================================
// Head + GraphQL
// =============================================================================

export const Head: HeadFC<Data, PageContext> = ({ pageContext }) => {
  const game = getGame(pageContext.gameId)
  return <title>{game ? `Deck · ${game.shortName ?? game.name} · tcgdb` : 'Deck · tcgdb'}</title>
}

export const query = graphql`
  query DeckDetail($gameId: String!) {
    allCard(filter: { gameId: { eq: $gameId } }, sort: { name: ASC }) {
      nodes {
        cardId
        gameId
        setId
        publisherId
        name
        nameAscii
        type
        unique
        text
        flavorText
        illustrator
        clan
        deck
        faction
        side
        cost
        military
        political
        militaryBonus
        politicalBonus
        glory
        strength
        influence
        influencePool
        element
        traits
        traitsAscii
      }
    }
  }
`
