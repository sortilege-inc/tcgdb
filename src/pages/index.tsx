import * as React from 'react'
import { Link, type HeadFC } from 'gatsby'
import { GAMES } from '../data/games'

export default function HomePage(): React.ReactElement {
  return (
    <>
      <h1>tcgdb</h1>
      <p style={{ opacity: 0.8, marginBottom: '2rem' }}>
        Personal multi-game TCG collection and deckbuilder. Pick a game to
        get started, or use the switcher in the nav.
      </p>

      <section>
        <h2 style={{ marginBottom: '1rem' }}>Games</h2>
        <ul
          style={{
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {GAMES.map((g) => (
            <li key={g.id}>
              <Link
                to={`/games/${g.id}/`}
                style={{
                  display: 'block',
                  padding: '1rem',
                  background: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  borderLeft: `4px solid ${g.theme.primary}`,
                  borderRadius: 8,
                  color: 'var(--theme-text)',
                  textDecoration: 'none',
                }}
              >
                <div style={{ fontWeight: 600 }}>{g.name}</div>
                {g.shortName && (
                  <div style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                    {g.shortName}
                  </div>
                )}
                <div
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    opacity: 0.7,
                  }}
                >
                  status: {g.status}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

export const Head: HeadFC = () => <title>tcgdb</title>
