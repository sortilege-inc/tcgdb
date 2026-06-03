import * as React from 'react'
import { Link, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'
import { getGameModule } from '../games/registry'

interface PageContext {
  gameId: string
}

export default function GameHomePage(
  props: PageProps<object, PageContext>
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const module = getGameModule(gameId)

  if (!game) {
    return (
      <>
        <h1>Unknown game</h1>
        <p>
          No game with id <code>{gameId}</code>. <Link to="/">Back home.</Link>
        </p>
      </>
    )
  }

  return (
    <>
      <header style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '0.15rem 0.5rem',
            fontSize: '0.75rem',
            background: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
            borderRadius: 999,
            opacity: 0.85,
            marginBottom: '0.5rem',
          }}
        >
          status: {game.status}
        </div>
        <h1>{game.name}</h1>
        {game.shortName && (
          <div style={{ opacity: 0.7 }}>{game.shortName}</div>
        )}
      </header>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Browse</h2>
        <ul style={{ listStyle: 'none', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <li>
            <Link
              to={`/games/${gameId}/cards/`}
              style={{
                display: 'inline-block',
                padding: '0.5rem 0.85rem',
                background: 'var(--theme-surface)',
                border: '1px solid var(--theme-border)',
                borderRadius: 6,
              }}
            >
              Cards →
            </Link>
          </li>
          <li>
            <Link
              to={`/games/${gameId}/sets/`}
              style={{
                display: 'inline-block',
                padding: '0.5rem 0.85rem',
                background: 'var(--theme-surface)',
                border: '1px solid var(--theme-border)',
                borderRadius: 6,
              }}
            >
              Sets →
            </Link>
          </li>
          <li>
            <Link
              to={`/games/${gameId}/collection/`}
              style={{
                display: 'inline-block',
                padding: '0.5rem 0.85rem',
                background: 'var(--theme-surface)',
                border: '1px solid var(--theme-border)',
                borderRadius: 6,
              }}
            >
              Collection →
            </Link>
          </li>
          <li>
            <Link
              to={`/games/${gameId}/decks/`}
              style={{
                display: 'inline-block',
                padding: '0.5rem 0.85rem',
                background: 'var(--theme-surface)',
                border: '1px solid var(--theme-border)',
                borderRadius: 6,
              }}
            >
              Decks →
            </Link>
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Module</h2>
        <p style={{ opacity: 0.8 }}>
          {module
            ? <>Loaded module: <code>{module.gameId}</code>.</>
            : <>No game module registered for <code>{gameId}</code>.</>}
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Formats</h2>
        {game.formats.length === 0 ? (
          <p style={{ opacity: 0.7 }}>None declared yet.</p>
        ) : (
          <ul style={{ paddingLeft: '1.25rem' }}>
            {game.formats.map((f) => (
              <li key={f.id}>{f.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Deck zones</h2>
        {game.deckZones.length === 0 ? (
          <p style={{ opacity: 0.7 }}>None declared yet.</p>
        ) : (
          <ul style={{ paddingLeft: '1.25rem' }}>
            {game.deckZones.map((z) => (
              <li key={z.id}>{z.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Publishers</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          {game.publishers.map((p) => (
            <li key={p.publisherId}>
              <code>{p.publisherId}</code> — {p.status}
              {p.notes && <span style={{ opacity: 0.7 }}> ({p.notes})</span>}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

export const Head: HeadFC<object, PageContext> = ({ pageContext }) => {
  const game = getGame(pageContext.gameId)
  return <title>{game ? `${game.name} · tcgdb` : 'tcgdb'}</title>
}
