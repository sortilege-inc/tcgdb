import * as React from 'react'
import { SidecarStateProvider } from '../state/SidecarStateProvider'
import { ActiveGameProvider } from '../state/ActiveGameProvider'
import { ConflictReporterProvider } from '../state/ConflictReporter'

interface Props {
  element: React.ReactNode
}

export function wrapRootElement({ element }: Props): React.ReactElement {
  return (
    <SidecarStateProvider>
      <ActiveGameProvider>
        <ConflictReporterProvider>{element}</ConflictReporterProvider>
      </ActiveGameProvider>
    </SidecarStateProvider>
  )
}
