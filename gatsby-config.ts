import type { GatsbyConfig } from 'gatsby'

const config: GatsbyConfig = {
  siteMetadata: {
    title: 'tcgdb',
    description: 'Personal multi-game TCG collection and deckbuilder.',
  },
  graphqlTypegen: true,
  plugins: [
    // Card / CardSet nodes are produced by our own sourceNodes step in
    // gatsby-node.ts so that the GraphQL types are stable across games
    // (Card / CardSet) rather than file-name-derived (CoreSetJson, ...).
    // games.json / publishers.json are read directly via src/data/* — small
    // and not worth a GraphQL round-trip.
  ],
}

export default config
