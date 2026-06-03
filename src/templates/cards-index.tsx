import * as React from 'react'
import { graphql, Link, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'
import { getGameModule } from '../games/registry'

interface PageContext {
  gameId: string
}

interface CardNode {
  cardId: string
  name: string
  type: string
  clan?: string | null
  deck?: string | null
  setId: string
  faction?: string | null
}

interface SetNode {
  setId: string
  name: string
  cycle?: string | null
}

interface Data {
  allCard: { nodes: CardNode[] }
  allCardSet: { nodes: SetNode[] }
}

export default function CardsIndexPage(
  props: PageProps<Data, PageContext>
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const module = getGameModule(gameId)
  const allCards = props.data.allCard.nodes
  const sets = props.data.allCardSet.nodes
  const setLookup = React.useMemo(
    () => Object.fromEntries(sets.map((s) => [s.setId, s] as const)),
    [sets]
  )

  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    if (!query.trim()) return allCards
    const lower = query.trim().toLowerCase()
    return allCards.filter((c) => {
      if (c.name.toLowerCase().includes(lower)) return true
      if (c.type.toLowerCase().includes(lower)) return true
      if (c.clan && c.clan.toLowerCase().includes(lower)) return true
      if (c.faction && c.faction.toLowerCase().includes(lower)) return true
      return false
    })
  }, [allCards, query])

  // Group by set for display.
  const grouped = React.useMemo(() => {
    const byset = new Map<string, CardNode[]>()
    for (const c of filtered) {
      const list = byset.get(c.setId) ?? []
      list.push(c)
      byset.set(c.setId, list)
    }
    return Array.from(byset.entries())
      .sort(([a], [b]) => {
        const an = setLookup[a]?.name ?? a
        const bn = setLookup[b]?.name ?? b
        return an.localeCompare(bn)
      })
  }, [filtered, setLookup])

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
        </p>
      </header>

      <input
        type="search"
        placeholder="Filter by name, type, clan…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
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

      {filtered.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No cards match.</p>
      ) : (
        grouped.map(([setId, cards]) => {
          const set = setLookup[setId]
          return (
            <section key={setId} style={{ marginBottom: '1.75rem' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                <Link to={`/games/${gameId}/sets/${setId}/`}>{set?.name ?? setId}</Link>{' '}
                <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
                  ({cards.length})
                </span>
              </h2>
              <ul style={{ listStyle: 'none' }}>
                {cards.map((c) => (
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
        })
      )}

      {module && (
        <footer style={{ opacity: 0.5, fontSize: '0.75rem', marginTop: '2rem' }}>
          Search powered by stub module for <code>{module.gameId}</code> —
          richer query syntax lands when the game module is fleshed out.
        </footer>
      )}
    </>
  )
}

export const Head: HeadFC<Data, PageContext> = ({ pageContext }) => {
  const game = getGame(pageContext.gameId)
  return <title>{game ? `Cards · ${game.shortName ?? game.name} · tcgdb` : 'Cards · tcgdb'}</title>
}

export const query = graphql`
  query CardsIndex($gameId: String!) {
    allCard(filter: { gameId: { eq: $gameId } }, sort: { cardId: ASC }) {
      nodes {
        cardId
        name
        type
        clan
        deck
        setId
        faction
      }
    }
    allCardSet(filter: { gameId: { eq: $gameId } }) {
      nodes {
        setId
        name
        cycle
      }
    }
  }
`
