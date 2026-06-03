import * as React from 'react'
import { Layout } from '../components/Layout'

interface Props {
  element: React.ReactNode
  props: { pageContext?: { gameId?: string }; path?: string }
}

export function wrapPageElement({ element, props }: Props): React.ReactElement {
  return <Layout pageProps={props}>{element}</Layout>
}
