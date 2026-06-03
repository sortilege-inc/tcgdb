import * as React from 'react'
import { graphql, Link, navigate, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'
import { getGameModule } from '../games/registry'
import { useDeck, useSidecarState } from '../state/SidecarStateProvider'
import { useConflictReporter } from '../state/ConflictReporter'
import type { Card, Deck, Format } from '../types/data'
import type { CardLookup, ValidationResult } from '../games/_types'

interface PageContext {
  gameId: string
}

interface CardNode {
  cardId: string
  gameId: string
  setId: string
  publisherId: string
  name: string
  type: string
  unique?: boolean | null
  text?: string | null
  flavorText?: string | null
  illustrator?: string | null
  clan?: string | null
  deck?: string | null
  faction?: string | null
  side?: string | null
  cost?: number | null
  strength?: number | null
  influence?: number | null
}

interface Data {
  allCard: { nodes: CardNode[] }
}

export default function DeckDetailPage(
  props: PageProps<Data, PageContext> & { params?: Record<string, string> }
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const module = getGameModule(gameId)

  // matchPath gives us the deckId via props.params; fall back to URL parse.
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

  const cardLookup: CardLookup = React.useMemo(() => {
    const byId = new Map(allCards.map((c) => [c.cardId, c]))
    return {
      get: (id: string) => byId.get(id) as Card | undefined,
      getMany: (ids: string[]) => ids.map((id) => byId.get(id)).filter((c): c is CardNode => !!c) as unknown as Card[],
    }
  }, [allCards])

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

  // After the null check, lock `deck` into a non-nullable local for closures.
  const liveDeck: Deck = deck

  const cardNames = React.useMemo(
    () => Object.fromEntries(allCards.map((c) => [c.cardId, c.name])),
    [allCards]
  )

  const format: Format = game.formats.find((f) => f.id === liveDeck.formatId) ?? {
    id: liveDeck.formatId, name: liveDeck.formatId,
  }

  const validation: ValidationResult | null = module
    ? module.validate({ deck: liveDeck, format, lookup: cardLookup })
    : null

  const stats = module ? module.computeDeckStats(liveDeck, format, cardLookup) : []
  const sections = module ? module.deckSections(liveDeck, cardLookup) : []

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
        description: 'The built-deck invariant guarantees every physically-sleeved card is actually available in your collection.',
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

  return (
    <>
      <header style={{ marginBottom: '1.5rem' }}>
        <Link to={`/games/${gameId}/decks/`} style={{ opacity: 0.7 }}>← Decks</Link>
        <h1 style={{ marginTop: '0.5rem' }}>
          <InlineEditText
            value={liveDeck.name}
            onCommit={(v) => onPatch({ name: v })}
            disabled={readOnly}
            ariaLabel="deck name"
          />
        </h1>
        <div style={{ opacity: 0.7, display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{format.name}</span>
          <span>· origin: {liveDeck.origin}</span>
          {liveDeck.importedFrom && <span style={{ opacity: 0.6 }}>from {liveDeck.importedFrom}</span>}
          <span>· updated {liveDeck.updatedAt.slice(0, 16).replace('T', ' ')}</span>
        </div>
      </header>

      {/* Stats + validation summary */}
      <section
        style={{
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 320px)',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        <div>
          {stats.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {stats.map((s) => (
                <span
                  key={s.key}
                  title={s.label}
                  style={{
                    padding: '0.25rem 0.6rem',
                    background: s.warning ? 'rgba(192, 57, 43, 0.18)' : 'var(--theme-surface)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: 999,
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ opacity: 0.7 }}>{s.label}:</span>{' '}
                  <strong>{s.value}</strong>
                </span>
              ))}
            </div>
          )}

          {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div
              style={{
                background: 'var(--theme-surface)',
                border: '1px solid var(--theme-border)',
                borderLeft: '4px solid var(--theme-primary)',
                borderRadius: 6,
                padding: '0.75rem 1rem',
                marginBottom: '0.75rem',
                fontSize: '0.9rem',
              }}
            >
              {validation.errors.map((e, i) => (
                <div key={`e${i}`} style={{ color: '#e8755a' }}>
                  ⚠ {e.message}
                </div>
              ))}
              {validation.warnings.map((w, i) => (
                <div key={`w${i}`} style={{ opacity: 0.85 }}>
                  ◦ {w.message}
                </div>
              ))}
            </div>
          )}
        </div>

        <aside
          style={{
            background: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            fontSize: '0.9rem',
          }}
        >
          <h2 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', opacity: 0.7 }}>Settings</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <input
              type="checkbox"
              checked={liveDeck.built}
              onChange={(e) => onPatch({ built: e.target.checked })}
              disabled={readOnly}
            />
            Built (physically sleeved)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={liveDeck.enforceErrata}
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
              marginTop: '0.75rem',
              background: 'transparent',
              border: '1px solid rgba(192, 57, 43, 0.6)',
              color: '#e8755a',
              padding: '0.3rem 0.65rem',
              width: '100%',
            }}
          >
            Delete deck
          </button>
        </aside>
      </section>

      {/* Per-zone view + add-card UI */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Decklist</h2>
        {game.deckZones.length === 0 && (
          <p style={{ opacity: 0.7 }}>No deck zones defined for this game.</p>
        )}
        {game.deckZones.map((z) => {
          const entries = liveDeck.zones[z.id] ?? []
          return (
            <DeckZoneBlock
              key={z.id}
              gameId={gameId}
              deck={liveDeck}
              zoneId={z.id}
              zoneName={z.name}
              entries={entries}
              allCards={allCards}
              onPatch={onPatch}
              disabled={readOnly}
            />
          )
        })}

        {sections.length > 0 && (
          <details style={{ marginTop: '1rem', opacity: 0.85 }}>
            <summary style={{ cursor: 'pointer', opacity: 0.7 }}>
              Sections (from game module's <code>deckSections</code>)
            </summary>
            <ul style={{ listStyle: 'none', marginTop: '0.5rem' }}>
              {sections.map((s, i) => (
                <li key={i} style={{ padding: '0.2rem 0' }}>
                  <strong>{s.title}</strong>:{' '}
                  {s.cardEntries.map((e) => `${e.qty}× ${e.cardId}`).join(', ')}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Notes */}
      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Notes</h2>
        <NotesEditor
          initial={liveDeck.notes ?? ''}
          onCommit={(v) => onPatch({ notes: v })}
          disabled={readOnly}
        />
      </section>

    </>
  )
}

// ---------- Inline-edit text -------------------------------------------------

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

// ---------- Notes editor -----------------------------------------------------

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
          padding: '0.65rem 0.75rem',
          background: 'var(--theme-surface)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-border)',
          borderRadius: 6,
          fontFamily: 'inherit',
          font: 'inherit',
          resize: 'vertical',
        }}
      />
      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onCommit(value)}
          disabled={!dirty || disabled}
          style={{
            background: dirty ? 'var(--theme-primary)' : 'var(--theme-surface)',
            color: dirty ? 'var(--theme-background)' : 'var(--theme-text)',
            border: dirty ? 'none' : '1px solid var(--theme-border)',
            padding: '0.4rem 0.8rem',
          }}
        >
          Save notes
        </button>
        {dirty && <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>unsaved changes</span>}
      </div>
    </>
  )
}

// ---------- Per-zone block + card add UI ------------------------------------

interface ZoneBlockProps {
  gameId: string
  deck: Deck
  zoneId: string
  zoneName: string
  entries: { cardId: string; qty: number }[]
  allCards: CardNode[]
  onPatch: (patch: Partial<Deck>) => Promise<void>
  disabled?: boolean
}

function DeckZoneBlock({
  gameId, deck, zoneId, zoneName, entries, allCards, onPatch, disabled,
}: ZoneBlockProps): React.ReactElement {
  const total = entries.reduce((n, e) => n + e.qty, 0)

  function setEntryQty(cardId: string, qty: number): Promise<void> {
    const nextEntries = qty <= 0
      ? entries.filter((e) => e.cardId !== cardId)
      : entries.some((e) => e.cardId === cardId)
        ? entries.map((e) => (e.cardId === cardId ? { ...e, qty } : e))
        : [...entries, { cardId, qty }]
    const nextZones = { ...deck.zones, [zoneId]: nextEntries }
    return onPatch({ zones: nextZones })
  }

  return (
    <section
      style={{
        marginBottom: '1rem',
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>{zoneName}</h3>
        <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{total} cards</span>
      </header>

      {entries.length > 0 && (
        <ul style={{ listStyle: 'none', marginBottom: '0.5rem' }}>
          {entries.map((e) => {
            const card = allCards.find((c) => c.cardId === e.cardId)
            return (
              <li
                key={e.cardId}
                style={{
                  padding: '0.25rem 0',
                  borderBottom: '1px solid var(--theme-border)',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}
              >
                <input
                  type="number"
                  min={0}
                  value={e.qty}
                  onChange={(ev) => void setEntryQty(e.cardId, Math.max(0, parseInt(ev.target.value || '0', 10)))}
                  disabled={disabled}
                  style={{ width: '4rem', padding: '0.1rem 0.3rem', background: 'var(--theme-surface)', color: 'var(--theme-text)', border: '1px solid var(--theme-border)', borderRadius: 4 }}
                />
                <span>
                  {card ? (
                    <Link to={`/games/${gameId}/cards/${e.cardId}/`}>{card.name}</Link>
                  ) : (
                    <code style={{ opacity: 0.6 }}>{e.cardId}</code>
                  )}
                  {card && (
                    <span style={{ opacity: 0.6, marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                      {card.type}{card.clan ? ` · ${card.clan}` : ''}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => void setEntryQty(e.cardId, 0)}
                  disabled={disabled}
                  title="Remove"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.7 }}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <AddCardInput
        allCards={allCards}
        disabled={disabled}
        onAdd={(cardId) => {
          const existing = entries.find((e) => e.cardId === cardId)
          return setEntryQty(cardId, (existing?.qty ?? 0) + 1)
        }}
      />
    </section>
  )
}

function AddCardInput({
  allCards, onAdd, disabled,
}: { allCards: CardNode[]; onAdd: (cardId: string) => Promise<void>; disabled?: boolean }): React.ReactElement {
  const [text, setText] = React.useState('')
  const matches = React.useMemo(() => {
    const q = text.trim().toLowerCase()
    if (!q) return []
    return allCards
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [allCards, text])

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a card by name…"
        disabled={disabled}
        style={{
          width: '100%',
          padding: '0.4rem 0.6rem',
          background: 'var(--theme-surface)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-border)',
          borderRadius: 6,
          font: 'inherit',
        }}
      />
      {matches.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            marginTop: '0.25rem',
            background: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
            borderRadius: 6,
            maxHeight: '12rem',
            overflowY: 'auto',
          }}
        >
          {matches.map((c) => (
            <li key={c.cardId}>
              <button
                type="button"
                onClick={async () => { await onAdd(c.cardId); setText('') }}
                disabled={disabled}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.3rem 0.6rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                <span>{c.name}</span>
                <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                  {c.type}{c.clan ? ` · ${c.clan}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

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
        strength
        influence
      }
    }
  }
`
