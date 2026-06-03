import * as React from 'react'
import { Link } from 'gatsby'
import { GameSwitcher } from './GameSwitcher'
import { useActiveGame } from '../state/ActiveGameProvider'
import { useSidecarState } from '../state/SidecarStateProvider'

export function Nav(): React.ReactElement {
  const { activeGameId, activeGame } = useActiveGame()
  const { readOnly, loading, error } = useSidecarState()

  return (
    <header
      style={{
        background: 'var(--theme-surface)',
        borderBottom: '1px solid var(--theme-border)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        <Link
          to="/"
          style={{
            fontWeight: 700,
            color: 'var(--theme-text)',
            textDecoration: 'none',
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: '0.9rem',
              height: '0.9rem',
              borderRadius: 2,
              background: 'var(--theme-primary)',
            }}
          />
          tcgdb
        </Link>

        {activeGameId && activeGame && (
          <nav aria-label="game-scoped" style={{ display: 'flex', gap: '1rem' }}>
            <Link to={`/games/${activeGameId}/`}>{activeGame.shortName ?? activeGame.name}</Link>
            <Link to={`/games/${activeGameId}/cards/`}>Cards</Link>
            <Link to={`/games/${activeGameId}/sets/`}>Sets</Link>
            <Link to={`/games/${activeGameId}/collection/`}>Collection</Link>
            <Link to={`/games/${activeGameId}/decks/`}>Decks</Link>
          </nav>
        )}

        <nav aria-label="cross-game" style={{ display: 'flex', gap: '1rem' }}>
          {/* Future: wishlist, sell lists, notes — placeholders shown faded until implemented */}
          <span style={{ opacity: 0.4 }}>Wishlist</span>
          <span style={{ opacity: 0.4 }}>Sell Lists</span>
          <span style={{ opacity: 0.4 }}>Notes</span>
          <Link to="/settings/">Settings</Link>
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {readOnly && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.15rem 0.5rem',
                background: 'var(--theme-surface-2, #1f242d)',
                border: '1px solid var(--theme-border)',
                borderRadius: 999,
                opacity: 0.85,
              }}
              title="This build is read-only; mutation is disabled."
            >
              read-only
            </span>
          )}
          {loading && (
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>loading…</span>
          )}
          {error && !loading && (
            <span
              style={{ fontSize: '0.75rem', color: '#e8755a' }}
              title={error}
            >
              sidecar offline
            </span>
          )}
          <GameSwitcher />
        </div>
      </div>
    </header>
  )
}
