import * as React from 'react'
import { Link, graphql, type HeadFC, type PageProps } from 'gatsby'
import { GAMES } from '../../data/games'
import { useSidecarState } from '../../state/SidecarStateProvider'

interface SetNode {
  setId: string
  gameId: string
  name: string
  status: string
}

interface Data {
  allCardSet: { nodes: SetNode[] }
}

export default function AuditPage(props: PageProps<Data>): React.ReactElement {
  const { state, loading } = useSidecarState()
  const sets = props.data.allCardSet.nodes

  // Unverified collection entries grouped by game.
  const unverifiedByGame = React.useMemo(() => {
    const out: Record<string, number> = {}
    for (const [gameId, entries] of Object.entries(state.collection ?? {})) {
      let count = 0
      for (const entry of Object.values(entries)) {
        if ((entry as { unverified?: boolean }).unverified) count++
      }
      if (count > 0) out[gameId] = count
    }
    return out
  }, [state.collection])

  const stubbedGames = GAMES.filter((g) => g.status === 'stubbed')
  const previewSets = sets.filter((s) => s.status === 'preview' || s.status === 'announced')

  const totalUnverified = Object.values(unverifiedByGame).reduce((a, b) => a + b, 0)

  return (
    <>
      <header style={{ marginBottom: '1.5rem' }}>
        <Link to="/settings/" style={{ opacity: 0.7 }}>← Settings</Link>
        <h1 style={{ marginTop: '0.5rem' }}>Audit</h1>
        <p style={{ opacity: 0.7 }}>
          What's flagged for review. Touching an unverified collection entry
          through the UI clears its flag — the act of editing is the
          confirmation.
        </p>
      </header>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          Unverified collection entries{' '}
          <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
            ({totalUnverified.toLocaleString()})
          </span>
        </h2>
        {loading && <p style={{ opacity: 0.6 }}>Loading state…</p>}
        {!loading && totalUnverified === 0 ? (
          <p style={{ opacity: 0.7 }}>None.</p>
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {Object.entries(unverifiedByGame).map(([gameId, count]) => {
              const game = GAMES.find((g) => g.id === gameId)
              return (
                <li
                  key={gameId}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderBottom: '1px solid var(--theme-border)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '1rem',
                    alignItems: 'baseline',
                  }}
                >
                  <Link to={`/games/${gameId}/collection/`}>
                    {game?.name ?? gameId}
                  </Link>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {count.toLocaleString()} entries
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          Stubbed game modules{' '}
          <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
            ({stubbedGames.length})
          </span>
        </h2>
        {stubbedGames.length === 0 ? (
          <p style={{ opacity: 0.7 }}>None.</p>
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {stubbedGames.map((g) => (
              <li
                key={g.id}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderBottom: '1px solid var(--theme-border)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '1rem',
                  alignItems: 'baseline',
                }}
              >
                <Link to={`/games/${g.id}/`}>{g.name}</Link>
                <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{g.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          Preview / unreleased sets{' '}
          <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
            ({previewSets.length})
          </span>
        </h2>
        {previewSets.length === 0 ? (
          <p style={{ opacity: 0.7 }}>None.</p>
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {previewSets.map((s) => (
              <li
                key={`${s.gameId}-${s.setId}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderBottom: '1px solid var(--theme-border)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '1rem',
                  alignItems: 'baseline',
                }}
              >
                <Link to={`/games/${s.gameId}/sets/${s.setId}/`}>{s.name}</Link>
                <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{s.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          Homebrew publishers{' '}
          <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>(0)</span>
        </h2>
        <p style={{ opacity: 0.7 }}>
          None yet. Homebrew sources get their own publisher records when
          added; they'll appear here once any exist.
        </p>
      </section>
    </>
  )
}

export const Head: HeadFC = () => <title>Audit · Settings · tcgdb</title>

export const query = graphql`
  query AuditPage {
    allCardSet {
      nodes {
        setId
        gameId
        name
        status
      }
    }
  }
`
