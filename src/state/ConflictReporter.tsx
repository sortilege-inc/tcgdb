import * as React from 'react'
import { SidecarError, type BuiltConflict } from './sidecar-client'
import { ConflictDialog } from '../components/ConflictDialog'

interface ConflictPayload {
  gameId: string
  conflicts: BuiltConflict[]
  title: string
  description?: string
  cardNames?: Record<string, string>
}

interface ConflictContextValue {
  /** Surface a conflict to the user. */
  reportConflict: (payload: ConflictPayload) => void
  /**
   * Convenience: if `err` is a SidecarError carrying conflicts, report it
   * and return true; otherwise return false so the caller can handle
   * non-conflict errors (e.g. show an alert).
   */
  reportIfConflict: (err: unknown, framing: { gameId: string; title: string; description?: string; cardNames?: Record<string, string> }) => boolean
}

const ConflictContext = React.createContext<ConflictContextValue>({
  reportConflict: () => {},
  reportIfConflict: () => false,
})

interface Props {
  children: React.ReactNode
}

export function ConflictReporterProvider({ children }: Props): React.ReactElement {
  const [payload, setPayload] = React.useState<ConflictPayload | null>(null)

  const reportConflict = React.useCallback((p: ConflictPayload) => {
    setPayload(p)
  }, [])

  const reportIfConflict = React.useCallback(
    (err: unknown, framing: { gameId: string; title: string; description?: string; cardNames?: Record<string, string> }): boolean => {
      if (err instanceof SidecarError && err.conflicts && err.conflicts.length > 0) {
        setPayload({
          gameId: framing.gameId,
          conflicts: err.conflicts,
          title: framing.title,
          description: framing.description,
          cardNames: framing.cardNames,
        })
        return true
      }
      return false
    },
    []
  )

  const value: ConflictContextValue = React.useMemo(
    () => ({ reportConflict, reportIfConflict }),
    [reportConflict, reportIfConflict]
  )

  return (
    <ConflictContext.Provider value={value}>
      {children}
      {payload && (
        <ConflictDialog
          gameId={payload.gameId}
          conflicts={payload.conflicts}
          title={payload.title}
          description={payload.description}
          cardNames={payload.cardNames}
          onDismiss={() => setPayload(null)}
        />
      )}
    </ConflictContext.Provider>
  )
}

export function useConflictReporter(): ConflictContextValue {
  return React.useContext(ConflictContext)
}
