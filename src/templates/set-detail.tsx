import * as React from 'react'
import { graphql, Link, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'
import { getGameModule } from '../games/registry'
import { useGameCollection } from '../state/SidecarStateProvider'
import type { Card, CardSet } from '../types/data'

interface PageContext {
  gameId: string
  setId: string
}

interface CardNode {
  cardId: string
  name: string
  type: string
  clan?: string | null
  deck?: string | null
  faction?: string | null
}

interface SetNode {
  setId: string
  name: string
  type: string
  cycle?: string | null
  status: string
  cardCount?: number | null
  releaseDate?: string | null
  publisherId: string
}

interface Data {
  cardSet: SetNode | null
  allCard: { nodes: CardNode[] }
}

export default function SetDetailPage(
  props: PageProps<Data, PageContext>
): React.ReactElement {
  const { gameId, setId } = props.pageContext
  const game = getGame(gameId)
  const module = getGameModule(gameId)
  const set = props.data.cardSet
  const cards = props.data.allCard.nodes
  const collection = useGameCollection(gameId)

  if (!set) {
    return (
      <>
        <h1>Set not found</h1>
        <p>
          No set <code>{setId}</code> in <code>{gameId}</code>.{' '}
          <Link to={`/games/${gameId}/sets/`}>Back to sets.</Link>
        </p>
      </>
    )
  }

  const rollup = React.useMemo(() => {
    let ownedDistinct = 0
    let ownedCopies = 0
    let expectedCopies = 0
    for (const c of cards) {
      const expected =
        module?.expectedCopiesPerBox(c as unknown as Card, set as unknown as CardSet) ?? 3
      expectedCopies += expected
      const owned = collection[c.cardId]?.qty ?? 0
      ownedCopies += Math.min(owned, expected)
      if (owned >= expected) ownedDistinct++
    }
    return {
      ownedDistinct,
      totalDistinct: cards.length,
      ownedCopies,
      expectedCopies,
      complete: cards.length > 0 && ownedDistinct === cards.length,
    }
  }, [cards, collection, module, set])

  return (
    <>
      <header style={{ marginBottom: '1.5rem' }}>
        <Link to={`/games/${gameId}/sets/`} style={{ opacity: 0.7 }}>
          ← {game?.shortName ?? game?.name ?? gameId} sets
        </Link>
        <h1 style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <span>{set.name}</span>
          {rollup.complete && (
            <span
              style={{
                padding: '0.15rem 0.5rem',
                background: 'rgba(39, 174, 96, 0.25)',
                border: '1px solid rgba(39, 174, 96, 0.5)',
                borderRadius: 999,
                fontSize: '0.75rem',
              }}
            >
              complete
            </span>
          )}
        </h1>
        <div style={{ opacity: 0.7, display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span>{set.type}</span>
          {set.cycle && <span>{set.cycle}</span>}
          {set.cardCount != null && <span>{set.cardCount} cards</span>}
          <span>
            owned: <strong>{rollup.ownedDistinct}</strong>/{rollup.totalDistinct} cards ·{' '}
            <strong>{rollup.ownedCopies}</strong>/{rollup.expectedCopies} copies
          </span>
          <Link to={`/games/${gameId}/collection/`} style={{ fontSize: '0.85rem' }}>
            edit collection →
          </Link>
        </div>
      </header>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Cards in this set</h2>
        {cards.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No cards.</p>
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {cards.map((c) => {
              const expected =
                module?.expectedCopiesPerBox(c as unknown as Card, set as unknown as CardSet) ?? 3
              const entry = collection[c.cardId]
              const owned = entry?.qty ?? 0
              const unverified = entry?.unverified === true
              const status: 'short' | 'ok' | 'over' =
                owned < expected ? 'short' : owned > expected ? 'over' : 'ok'
              const statusBg =
                status === 'short' ? 'rgba(192, 57, 43, 0.18)'
                : status === 'over' ? 'rgba(41, 128, 185, 0.18)'
                : 'rgba(39, 174, 96, 0.18)'
              return (
                <li
                  key={c.cardId}
                  style={{
                    padding: '0.3rem 0.5rem',
                    borderBottom: '1px solid var(--theme-border)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                    background: statusBg,
                  }}
                >
                  <Link to={`/games/${gameId}/cards/${c.cardId}/`}>{c.name}</Link>
                  <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{c.type}</span>
                  <span style={{ opacity: 0.6, fontSize: '0.8rem', minWidth: '5rem', textAlign: 'right' }}>
                    {c.clan ?? c.faction ?? ''}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem', minWidth: '3.5rem', textAlign: 'right' }}>
                    {unverified && (
                      <span
                        title="Unverified — count came from an external import."
                        style={{ opacity: 0.55, marginRight: '0.25rem' }}
                      >
                        ?
                      </span>
                    )}
                    {owned}<span style={{ opacity: 0.5 }}>/{expected}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

export const Head: HeadFC<Data, PageContext> = ({ data }) => {
  const set = data.cardSet
  return <title>{set ? `${set.name} · tcgdb` : 'Set · tcgdb'}</title>
}

export const query = graphql`
  query SetDetail($gameId: String!, $setId: String!) {
    cardSet(gameId: { eq: $gameId }, setId: { eq: $setId }) {
      setId
      name
      type
      cycle
      status
      cardCount
      releaseDate
      publisherId
    }
    allCard(
      filter: { gameId: { eq: $gameId }, setId: { eq: $setId } }
      sort: { cardId: ASC }
    ) {
      nodes {
        cardId
        name
        type
        clan
        deck
        faction
      }
    }
  }
`
