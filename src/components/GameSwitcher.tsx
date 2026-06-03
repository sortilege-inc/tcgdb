import * as React from 'react'
import { navigate } from 'gatsby'
import { GAMES } from '../data/games'
import { useActiveGame } from '../state/ActiveGameProvider'

export function GameSwitcher(): React.ReactElement {
  const { activeGameId, setActiveGame } = useActiveGame()
  const [open, setOpen] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const active = activeGameId ? GAMES.find((g) => g.id === activeGameId) : null

  function activate(gameId: string | null) {
    setOpen(false)
    setActiveGame(gameId)
    if (gameId) {
      void navigate(`/games/${gameId}/`)
    } else {
      void navigate('/')
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          minWidth: '12rem',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>
          {active ? (
            <>
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  background: active.theme.primary,
                  marginRight: '0.5rem',
                  verticalAlign: '-1px',
                }}
              />
              {active.shortName ?? active.name}
            </>
          ) : (
            'Pick a game'
          )}
        </span>
        <span aria-hidden style={{ opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.25rem)',
            right: 0,
            zIndex: 20,
            listStyle: 'none',
            background: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
            borderRadius: 6,
            padding: '0.25rem',
            minWidth: '16rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {GAMES.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => activate(g.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: '1px solid transparent',
                  background: g.id === activeGameId ? 'var(--theme-surface-2, #1f242d)' : 'transparent',
                  marginBottom: '0.125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: '0.75rem',
                    height: '0.75rem',
                    borderRadius: '50%',
                    background: g.theme.primary,
                  }}
                />
                <span>{g.name}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => activate(null)}
              style={{
                width: '100%',
                textAlign: 'left',
                marginTop: '0.25rem',
                borderTop: '1px solid var(--theme-border)',
                borderRadius: 0,
                background: 'transparent',
              }}
            >
              No active game (home)
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
