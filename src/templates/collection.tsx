import * as React from 'react'
import { graphql, Link, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'
import { getGameModule } from '../games/registry'
import { useGameCollection, useSidecarState } from '../state/SidecarStateProvider'
import { CollectionCounter } from '../components/CollectionCounter'
import { CardLink } from '../components/CardLink'
import type { Card, CardSet } from '../types/data'

interface PageContext {
  gameId: string
}

interface CardNode {
  cardId: string
  name: string
  type: string
  setId: string
  clan?: string | null
  deck?: string | null
  faction?: string | null
}

interface SetNode {
  setId: string
  name: string
  type: string
  cycle?: string | null
}

interface Data {
  allCard: { nodes: CardNode[] }
  allCardSet: { nodes: SetNode[] }
}

interface SetRollup {
  ownedDistinct: number
  totalDistinct: number
  ownedCopies: number
  expectedCopies: number
  complete: boolean
}

export default function CollectionPage(
  props: PageProps<Data, PageContext>
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const module = getGameModule(gameId)
  const collection = useGameCollection(gameId)
  const { loading, error, readOnly } = useSidecarState()

  const allCards = props.data.allCard.nodes
  const sets = props.data.allCardSet.nodes
  const setById = React.useMemo(
    () => Object.fromEntries(sets.map((s) => [s.setId, s] as const)),
    [sets]
  )

  const [filter, setFilter] = React.useState('')
  const filtered = React.useMemo(() => {
    if (!filter.trim()) return allCards
    const lower = filter.trim().toLowerCase()
    return allCards.filter((c) => {
      if (c.name.toLowerCase().includes(lower)) return true
      if (c.type.toLowerCase().includes(lower)) return true
      if (c.clan && c.clan.toLowerCase().includes(lower)) return true
      return false
    })
  }, [allCards, filter])

  const grouped = React.useMemo(() => {
    const map = new Map<string, CardNode[]>()
    for (const c of filtered) {
      const list = map.get(c.setId) ?? []
      list.push(c)
      map.set(c.setId, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const an = setById[a]?.name ?? a
      const bn = setById[b]?.name ?? b
      return an.localeCompare(bn)
    })
  }, [filtered, setById])

  // Per-set rollup (against the full card list for the set, not the filter).
  const rollups = React.useMemo(() => {
    const cardsBySetFull = new Map<string, CardNode[]>()
    for (const c of allCards) {
      const list = cardsBySetFull.get(c.setId) ?? []
      list.push(c)
      cardsBySetFull.set(c.setId, list)
    }
    const out: Record<string, SetRollup> = {}
    for (const [setId, cards] of cardsBySetFull.entries()) {
      const set = setById[setId]
      if (!set) continue
      let ownedDistinct = 0
      let ownedCopies = 0
      let expectedCopies = 0
      for (const c of cards) {
        const expected = module?.expectedCopiesPerBox(c as unknown as Card, set as unknown as CardSet) ?? 3
        expectedCopies += expected
        const entry = collection[c.cardId]
        const owned = entry?.qty ?? 0
        ownedCopies += Math.min(owned, expected)
        if (owned >= expected) ownedDistinct++
      }
      out[setId] = {
        ownedDistinct,
        totalDistinct: cards.length,
        ownedCopies,
        expectedCopies,
        complete: ownedDistinct === cards.length && cards.length > 0,
      }
    }
    return out
  }, [allCards, setById, collection, module])

  return (
    <>
      <header style={{ marginBottom: '1rem' }}>
        <Link to={`/games/${gameId}/`} style={{ opacity: 0.7 }}>
          ← {game?.shortName ?? game?.name ?? gameId}
        </Link>
        <h1 style={{ marginTop: '0.5rem' }}>Collection</h1>
        <p style={{ opacity: 0.7 }}>
          Adjust per-card quantities. Counts persist via the sidecar.
          {readOnly && <strong> (read-only build — controls disabled)</strong>}
        </p>
        {loading && <p style={{ opacity: 0.6 }}>Loading state…</p>}
        {error && (
          <p style={{ color: '#e8755a' }}>
            Sidecar error: {error}
          </p>
        )}
      </header>

      <input
        type="search"
        placeholder="Filter by name, type, clan…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{
          width: '100%',
          padding: '0.55rem 0.75rem',
          marginBottom: '1.5rem',
          background: 'var(--theme-surface)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-border)',
          borderRadius: 6,
          font: 'inherit',
        }}
      />

      {grouped.map(([setId, cards]) => {
        const set = setById[setId]
        const rollup = rollups[setId]
        return (
          <SetGroup
            key={setId}
            gameId={gameId}
            setId={setId}
            setName={set?.name ?? setId}
            cycle={set?.cycle ?? null}
            cards={cards}
            collection={collection}
            module={module}
            rollup={rollup}
            allSetCards={set ? allCards.filter((c) => c.setId === setId) : cards}
            setNode={set ?? null}
          />
        )
      })}
    </>
  )
}

interface SetGroupProps {
  gameId: string
  setId: string
  setName: string
  cycle: string | null
  cards: CardNode[]
  collection: Record<string, { qty: number; promoQty: number }>
  module: ReturnType<typeof getGameModule> | undefined
  rollup: SetRollup | undefined
  allSetCards: CardNode[]
  setNode: SetNode | null
}

function SetGroup({
  gameId, setId, setName, cycle, cards, collection, module, rollup, setNode,
}: SetGroupProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)

  const headerStatus =
    rollup
      ? rollup.complete
        ? 'complete'
        : `${rollup.ownedDistinct}/${rollup.totalDistinct} cards · ${rollup.ownedCopies}/${rollup.expectedCopies} copies`
      : ''

  return (
    <section
      style={{
        marginBottom: '0.75rem',
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span aria-hidden style={{ opacity: 0.6, width: '1rem' }}>{open ? '▾' : '▸'}</span>
        <span style={{ flex: 1 }}>
          <Link
            to={`/games/${gameId}/sets/${setId}/`}
            onClick={(e) => e.stopPropagation()}
            style={{ color: 'var(--theme-text)' }}
          >
            {setName}
          </Link>
          {cycle && <span style={{ opacity: 0.6, marginLeft: '0.5rem', fontSize: '0.85rem' }}>{cycle}</span>}
        </span>
        {rollup?.complete && (
          <span
            style={{
              padding: '0.1rem 0.5rem',
              background: 'rgba(39, 174, 96, 0.25)',
              border: '1px solid rgba(39, 174, 96, 0.5)',
              borderRadius: 999,
              fontSize: '0.75rem',
            }}
          >
            complete
          </span>
        )}
        <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{headerStatus}</span>
      </button>

      {open && (
        <ul style={{ listStyle: 'none', padding: '0 1rem 0.75rem' }}>
          {cards.map((c) => {
            const entry = collection[c.cardId] ?? { qty: 0, promoQty: 0 }
            const expected = setNode
              ? module?.expectedCopiesPerBox(c as unknown as Card, setNode as unknown as CardSet) ?? 3
              : undefined
            return (
              <li
                key={c.cardId}
                style={{
                  padding: '0.4rem 0',
                  borderBottom: '1px solid var(--theme-border)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '0.75rem',
                  alignItems: 'center',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <CardLink gameId={gameId} cardId={c.cardId} name={c.name} />
                  <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                    {c.type}
                    {c.clan && ` · ${c.clan}`}
                  </div>
                </div>
                <CollectionCounter
                  gameId={gameId}
                  cardId={c.cardId}
                  qty={entry.qty}
                  promoQty={entry.promoQty}
                  expected={expected}
                  unverified={(entry as { unverified?: boolean }).unverified}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export const Head: HeadFC<Data, PageContext> = ({ pageContext }) => {
  const game = getGame(pageContext.gameId)
  return (
    <title>
      {game ? `Collection · ${game.shortName ?? game.name} · tcgdb` : 'Collection · tcgdb'}
    </title>
  )
}

export const query = graphql`
  query CollectionPage($gameId: String!) {
    allCard(filter: { gameId: { eq: $gameId } }, sort: { cardId: ASC }) {
      nodes {
        cardId
        name
        type
        setId
        clan
        deck
        faction
      }
    }
    allCardSet(filter: { gameId: { eq: $gameId } }, sort: { name: ASC }) {
      nodes {
        setId
        name
        type
        cycle
      }
    }
  }
`
