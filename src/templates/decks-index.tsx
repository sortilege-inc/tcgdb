import * as React from 'react'
import { Link, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'
import { useGameCollection, useGameDecks, useSidecarState } from '../state/SidecarStateProvider'
import { computeDeckAvailability, type DeckAvailability } from '../lib/deck-availability'
import type { Deck } from '../types/data'

interface PageContext {
  gameId: string
}

type OriginFilter = 'all' | 'own' | 'imported'
type BuiltFilter = 'any' | 'built' | 'unbuilt'
type BuildableFilter = 'any' | 'yes' | 'no'

export default function DecksIndexPage(
  props: PageProps<object, PageContext>
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const decks = useGameDecks(gameId)
  const collection = useGameCollection(gameId)
  const { loading, error, readOnly, deleteDeck } = useSidecarState()

  const [origin, setOrigin] = React.useState<OriginFilter>('all')
  const [builtFilter, setBuiltFilter] = React.useState<BuiltFilter>('any')
  const [buildable, setBuildable] = React.useState<BuildableFilter>('any')

  // availability per deck
  const availability = React.useMemo(() => {
    const out = new Map<string, DeckAvailability>()
    for (const d of decks) {
      out.set(d.id, computeDeckAvailability(d, decks, collection))
    }
    return out
  }, [decks, collection])

  const filtered = React.useMemo(() => {
    return decks
      .filter((d) => origin === 'all' || d.origin === origin)
      .filter((d) => builtFilter === 'any' || (builtFilter === 'built' ? d.built : !d.built))
      .filter((d) => {
        if (buildable === 'any') return true
        const a = availability.get(d.id)
        if (!a) return true
        return buildable === 'yes' ? a.buildable : !a.buildable
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [decks, origin, builtFilter, buildable, availability])

  return (
    <>
      <header style={{ marginBottom: '1.5rem' }}>
        <Link to={`/games/${gameId}/`} style={{ opacity: 0.7 }}>
          ← {game?.shortName ?? game?.name ?? gameId}
        </Link>
        <h1 style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <span>Decks</span>
          <span style={{ opacity: 0.5, fontSize: '0.9rem', fontWeight: 400 }}>
            {decks.length} saved
          </span>
        </h1>
        {loading && <p style={{ opacity: 0.6 }}>Loading state…</p>}
        {error && <p style={{ color: '#e8755a' }}>Sidecar error: {error}</p>}
      </header>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <FilterGroup label="origin" value={origin} options={['all', 'own', 'imported']} onChange={(v) => setOrigin(v as OriginFilter)} />
        <FilterGroup label="built" value={builtFilter} options={['any', 'built', 'unbuilt']} onChange={(v) => setBuiltFilter(v as BuiltFilter)} />
        <FilterGroup label="can build now" value={buildable} options={['any', 'yes', 'no']} onChange={(v) => setBuildable(v as BuildableFilter)} />
        <span style={{ flex: 1 }} />
        {!readOnly && (
          <Link
            to={`/games/${gameId}/decks/new/`}
            style={{
              display: 'inline-block',
              padding: '0.4rem 0.8rem',
              background: 'var(--theme-surface-2, #1f242d)',
              border: '1px solid var(--theme-border)',
              borderLeft: '4px solid var(--theme-primary)',
              borderRadius: 6,
              color: 'var(--theme-text)',
            }}
          >
            + New deck
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <p style={{ opacity: 0.7 }}>
          {decks.length === 0 ? 'No decks yet.' : 'No decks match these filters.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none' }}>
          {filtered.map((d) => (
            <DeckRow
              key={d.id}
              gameId={gameId}
              deck={d}
              availability={availability.get(d.id)}
              readOnly={readOnly}
              onDelete={async () => {
                if (!window.confirm(`Delete "${d.name}"? This cannot be undone.`)) return
                try {
                  await deleteDeck(gameId, d.id)
                } catch (err: unknown) {
                  alert(`Failed: ${err instanceof Error ? err.message : String(err)}`)
                }
              }}
            />
          ))}
        </ul>
      )}
    </>
  )
}

function FilterGroup({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{label}</span>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            background: opt === value ? 'var(--theme-primary)' : 'var(--theme-surface)',
            color: opt === value ? 'var(--theme-background)' : 'var(--theme-text)',
            border: '1px solid var(--theme-border)',
            padding: '0.25rem 0.6rem',
            fontSize: '0.85rem',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function DeckRow({
  gameId, deck, availability, readOnly, onDelete,
}: {
  gameId: string
  deck: Deck
  availability: DeckAvailability | undefined
  readOnly: boolean
  onDelete: () => void | Promise<void>
}): React.ReactElement {
  const totalCards = React.useMemo(() => {
    let n = 0
    for (const entries of Object.values(deck.zones)) {
      for (const e of entries) n += e.qty
    }
    return n
  }, [deck])

  const availText = availability && availability.totalNeeded > 0
    ? `${availability.availableFree}/${availability.totalNeeded}`
    : '—'
  const availStatus: 'ok' | 'short' | 'empty' =
    !availability || availability.totalNeeded === 0
      ? 'empty'
      : availability.buildable
        ? 'ok'
        : 'short'

  return (
    <li
      style={{
        padding: '0.65rem 0.75rem',
        borderBottom: '1px solid var(--theme-border)',
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto auto auto auto',
        gap: '0.75rem',
        alignItems: 'baseline',
      }}
    >
      <Link to={`/games/${gameId}/decks/${deck.id}/`} style={{ minWidth: 0 }}>
        {deck.name}
      </Link>
      <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{deck.formatId}</span>
      <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{deck.origin}</span>
      {deck.built ? (
        <span
          style={{
            padding: '0.05rem 0.45rem',
            background: 'rgba(39, 174, 96, 0.25)',
            border: '1px solid rgba(39, 174, 96, 0.5)',
            borderRadius: 999,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          built
        </span>
      ) : (
        <span />
      )}
      <span
        title={
          availability
            ? `Available now (counting collection used by other built decks as unavailable): ${availability.availableFree}/${availability.totalNeeded}.\nIgnoring built reservations: ${availability.availableNow}/${availability.totalNeeded}.\n${availability.reservedByBuilt > 0 ? `${availability.reservedByBuilt} copies are tied up in other built decks.` : ''}`
            : ''
        }
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: '0.85rem',
          background:
            availStatus === 'ok' ? 'rgba(39, 174, 96, 0.18)'
            : availStatus === 'short' ? 'rgba(192, 57, 43, 0.18)'
            : 'transparent',
          padding: '0.05rem 0.45rem',
          borderRadius: 4,
        }}
      >
        {availText}
        {availability && availability.reservedByBuilt > 0 && (
          <span style={{ opacity: 0.65, marginLeft: '0.25rem', fontSize: '0.78rem' }}>
            (+{availability.reservedByBuilt} reserved)
          </span>
        )}
      </span>
      <span style={{ opacity: 0.5, fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
        {totalCards} cards · {deck.updatedAt.slice(0, 10)}
      </span>
      <button
        type="button"
        onClick={() => { void onDelete() }}
        disabled={readOnly}
        title={readOnly ? 'Read-only build' : `Delete "${deck.name}"`}
        aria-label={`Delete ${deck.name}`}
        style={{
          background: 'transparent',
          border: '1px solid transparent',
          color: 'var(--theme-text-muted, #9aa1ad)',
          padding: '0.1rem 0.4rem',
          fontSize: '0.85rem',
          cursor: readOnly ? 'not-allowed' : 'pointer',
          opacity: readOnly ? 0.35 : 0.7,
          borderRadius: 4,
        }}
        onMouseEnter={(e) => {
          if (readOnly) return
          e.currentTarget.style.color = '#e8755a'
          e.currentTarget.style.borderColor = 'rgba(192, 57, 43, 0.45)'
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--theme-text-muted, #9aa1ad)'
          e.currentTarget.style.borderColor = 'transparent'
          e.currentTarget.style.opacity = readOnly ? '0.35' : '0.7'
        }}
      >
        ✕
      </button>
    </li>
  )
}

export const Head: HeadFC<object, PageContext> = ({ pageContext }) => {
  const game = getGame(pageContext.gameId)
  return (
    <title>
      {game ? `Decks · ${game.shortName ?? game.name} · tcgdb` : 'Decks · tcgdb'}
    </title>
  )
}
