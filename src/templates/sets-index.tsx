import * as React from 'react'
import { graphql, Link, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'

interface PageContext {
  gameId: string
}

interface SetNode {
  setId: string
  name: string
  type: string
  cycle?: string | null
  status: string
  cardCount?: number | null
  releaseDate?: string | null
}

interface Data {
  allCardSet: { nodes: SetNode[] }
}

export default function SetsIndexPage(
  props: PageProps<Data, PageContext>
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const sets = props.data.allCardSet.nodes

  // Group by cycle (where present), then loose sets at the end.
  const grouped = React.useMemo(() => {
    const groups = new Map<string, SetNode[]>()
    const loose: SetNode[] = []
    for (const s of sets) {
      if (s.cycle) {
        const list = groups.get(s.cycle) ?? []
        list.push(s)
        groups.set(s.cycle, list)
      } else {
        loose.push(s)
      }
    }
    return { groups, loose }
  }, [sets])

  return (
    <>
      <header style={{ marginBottom: '1.5rem' }}>
        <Link to={`/games/${gameId}/`} style={{ opacity: 0.7 }}>
          ← {game?.shortName ?? game?.name ?? gameId}
        </Link>
        <h1 style={{ marginTop: '0.5rem' }}>Sets</h1>
        <p style={{ opacity: 0.7 }}>
          {sets.length} set{sets.length === 1 ? '' : 's'} on file.
        </p>
      </header>

      {sets.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No sets loaded yet.</p>
      ) : (
        <>
          {grouped.loose.length > 0 && <SetList sets={grouped.loose} gameId={gameId} />}
          {Array.from(grouped.groups.entries()).map(([cycle, members]) => (
            <section key={cycle} style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{cycle}</h2>
              <SetList sets={members} gameId={gameId} />
            </section>
          ))}
        </>
      )}
    </>
  )
}

function SetList({ sets, gameId }: { sets: SetNode[]; gameId: string }): React.ReactElement {
  return (
    <ul style={{ listStyle: 'none' }}>
      {sets.map((s) => (
        <li
          key={s.setId}
          style={{
            padding: '0.5rem 0.75rem',
            borderBottom: '1px solid var(--theme-border)',
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: '0.75rem',
            alignItems: 'baseline',
          }}
        >
          <Link to={`/games/${gameId}/sets/${s.setId}/`}>{s.name}</Link>
          <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{s.type}</span>
          <span
            style={{
              opacity: 0.6,
              fontSize: '0.8rem',
              minWidth: '4rem',
              textAlign: 'right',
            }}
          >
            {s.cardCount != null ? `${s.cardCount} cards` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

export const Head: HeadFC<Data, PageContext> = ({ pageContext }) => {
  const game = getGame(pageContext.gameId)
  return <title>{game ? `Sets · ${game.shortName ?? game.name} · tcgdb` : 'Sets · tcgdb'}</title>
}

export const query = graphql`
  query SetsIndex($gameId: String!) {
    allCardSet(filter: { gameId: { eq: $gameId } }, sort: { name: ASC }) {
      nodes {
        setId
        name
        type
        cycle
        status
        cardCount
        releaseDate
      }
    }
  }
`
