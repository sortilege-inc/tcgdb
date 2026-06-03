import * as React from 'react'
import type { Game, GameTheme } from '../types/data'
import { getGame } from '../data/games'
import { GAME_MODULES } from '../games/registry'
import type { GameModule } from '../games/_types'

interface ActiveGameValue {
  activeGameId: string | null
  activeGame: Game | null
  activeModule: GameModule | null
  activeTheme: GameTheme | null
  setActiveGame: (gameId: string | null) => void
}

const ActiveGameContext = React.createContext<ActiveGameValue>({
  activeGameId: null,
  activeGame: null,
  activeModule: null,
  activeTheme: null,
  setActiveGame: () => {},
})

const STORAGE_KEY = 'tcgdb.activeGameId'

function deriveFromPath(pathname: string): string | null {
  const m = /^\/games\/([^/]+)/.exec(pathname)
  return m ? m[1]! : null
}

function readStored(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(value: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* ignore */
  }
}

interface Props {
  children: React.ReactNode
}

export function ActiveGameProvider({ children }: Props): React.ReactElement {
  const [activeGameId, setActiveGameIdInternal] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const fromPath = deriveFromPath(window.location.pathname)
    const stored = readStored()
    setActiveGameIdInternal(fromPath ?? stored)
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      const fromPath = deriveFromPath(window.location.pathname)
      if (fromPath) {
        setActiveGameIdInternal(fromPath)
        writeStored(fromPath)
      }
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const setActiveGame = React.useCallback((gameId: string | null) => {
    setActiveGameIdInternal(gameId)
    writeStored(gameId)
  }, [])

  const value: ActiveGameValue = React.useMemo(() => {
    const game = activeGameId ? getGame(activeGameId) ?? null : null
    const module = activeGameId ? GAME_MODULES[activeGameId] ?? null : null
    const theme = game?.theme ?? null
    return {
      activeGameId,
      activeGame: game,
      activeModule: module,
      activeTheme: theme,
      setActiveGame,
    }
  }, [activeGameId, setActiveGame])

  return (
    <ActiveGameContext.Provider value={value}>
      {children}
    </ActiveGameContext.Provider>
  )
}

export function useActiveGame(): ActiveGameValue {
  return React.useContext(ActiveGameContext)
}
