import type { GatsbyNode } from 'gatsby'
import path from 'node:path'
import fs from 'node:fs'
import type { Card, CardSet } from './src/types/data'

interface GameRecord {
  id: string
  name: string
}

interface RedirectRecord {
  from: string
  to: string
  isPermanent?: boolean
}

const dataDir = path.resolve(__dirname, 'data')

function readJson<T>(relPath: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, relPath), 'utf-8')) as T
}

function safeListDir(absPath: string): string[] {
  try {
    return fs.readdirSync(absPath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

// -----------------------------------------------------------------------
// Schema customisation: stable GraphQL types regardless of source files
// -----------------------------------------------------------------------

export const createSchemaCustomization: GatsbyNode['createSchemaCustomization'] = ({ actions }) => {
  const { createTypes } = actions
  createTypes(`
    type Card implements Node @dontInfer {
      cardId: String!
      gameId: String!
      setId: String!
      publisherId: String!
      name: String!
      type: String!
      unique: Boolean
      text: String
      flavorText: String
      illustrator: String
      imagePath: String
      unverified: Boolean
      # cardId of the other side, when this is a physical two-sided card.
      flipSideOf: String
      # game-specific fields (sparse, optional, additive across games):
      clan: String
      deck: String
      faction: String
      side: String
      cost: Int
      strength: Int
      influence: Int
      # L5R-specific:
      military: Int
      political: Int
      glory: Int
      honor: Int
      fate: Int
      influencePool: Int
      element: String
      traits: [String]
      # Errata override (any subset of card fields can change). Stored as
      # JSON so the override is field-shape-flexible without enumerating
      # every possible field at the schema layer.
      errata: JSON
      rulings: [CardRuling]
    }
    type CardRuling {
      date: String
      source: String
      text: String
    }
    type CardSet implements Node @dontInfer {
      setId: String!
      gameId: String!
      publisherId: String!
      name: String!
      type: String!
      cycle: String
      parentSetId: String
      releaseDate: String
      status: String!
      cardCount: Int
    }
  `)
}

// -----------------------------------------------------------------------
// Source Card / CardSet nodes from data/cards and data/sets
// -----------------------------------------------------------------------

export const sourceNodes: GatsbyNode['sourceNodes'] = async ({ actions, createNodeId, createContentDigest, reporter }) => {
  const { createNode } = actions

  // Sets ------------------------------------------------------------------
  const setsRoot = path.join(dataDir, 'sets')
  let setCount = 0
  for (const gameDir of safeListDir(setsRoot)) {
    const gameAbs = path.join(setsRoot, gameDir)
    if (!fs.statSync(gameAbs).isDirectory()) continue
    for (const file of safeListDir(gameAbs)) {
      if (!file.endsWith('.json')) continue
      const set = JSON.parse(fs.readFileSync(path.join(gameAbs, file), 'utf-8')) as CardSet
      const { id: entityId, ...rest } = set
      createNode({
        ...rest,
        setId: entityId,
        id: createNodeId(`CardSet-${set.gameId}-${entityId}`),
        internal: {
          type: 'CardSet',
          contentDigest: createContentDigest(set),
        },
      })
      setCount++
    }
  }

  // Cards -----------------------------------------------------------------
  const cardsRoot = path.join(dataDir, 'cards')
  let cardCount = 0
  for (const gameDir of safeListDir(cardsRoot)) {
    const gameAbs = path.join(cardsRoot, gameDir)
    if (!fs.statSync(gameAbs).isDirectory()) continue
    for (const file of safeListDir(gameAbs)) {
      if (!file.endsWith('.json')) continue
      const cards = JSON.parse(fs.readFileSync(path.join(gameAbs, file), 'utf-8')) as Card[]
      for (const card of cards) {
        const { id: entityId, ...rest } = card
        createNode({
          ...rest,
          cardId: entityId,
          id: createNodeId(`Card-${card.gameId}-${entityId}`),
          internal: {
            type: 'Card',
            contentDigest: createContentDigest(card),
          },
        })
        cardCount++
      }
    }
  }

  reporter.info(`[tcgdb] Sourced ${setCount} CardSet and ${cardCount} Card nodes.`)
}

// -----------------------------------------------------------------------
// Create per-game / per-card / per-set pages
// -----------------------------------------------------------------------

export const createPages: GatsbyNode['createPages'] = async ({ actions, graphql, reporter }) => {
  const { createPage, createRedirect } = actions

  const games = readJson<GameRecord[]>('games.json')
  const gameHome = path.resolve(__dirname, 'src/templates/game-home.tsx')
  const cardsIndex = path.resolve(__dirname, 'src/templates/cards-index.tsx')
  const cardDetail = path.resolve(__dirname, 'src/templates/card-detail.tsx')
  const setsIndex = path.resolve(__dirname, 'src/templates/sets-index.tsx')
  const setDetail = path.resolve(__dirname, 'src/templates/set-detail.tsx')
  const collectionPage = path.resolve(__dirname, 'src/templates/collection.tsx')
  const decksIndex = path.resolve(__dirname, 'src/templates/decks-index.tsx')
  const deckCreate = path.resolve(__dirname, 'src/templates/deck-create.tsx')
  const deckDetail = path.resolve(__dirname, 'src/templates/deck-detail.tsx')

  for (const game of games) {
    createPage({
      path: `/games/${game.id}/`,
      component: gameHome,
      context: { gameId: game.id },
    })
    createPage({
      path: `/games/${game.id}/cards/`,
      component: cardsIndex,
      context: { gameId: game.id },
    })
    createPage({
      path: `/games/${game.id}/sets/`,
      component: setsIndex,
      context: { gameId: game.id },
    })
    createPage({
      path: `/games/${game.id}/collection/`,
      component: collectionPage,
      context: { gameId: game.id },
    })
    createPage({
      path: `/games/${game.id}/decks/`,
      component: decksIndex,
      context: { gameId: game.id },
    })
    createPage({
      path: `/games/${game.id}/decks/new/`,
      component: deckCreate,
      context: { gameId: game.id },
    })
    // Client-only-style: one placeholder page with a matchPath that catches
    // any /decks/<id>/ — deck IDs are runtime values, not known at build.
    createPage({
      path: `/games/${game.id}/decks/__deck/`,
      matchPath: `/games/${game.id}/decks/:deckId/`,
      component: deckDetail,
      context: { gameId: game.id },
    })
  }

  // Card-detail pages -----------------------------------------------------
  const cardResult = await graphql<{ allCard: { nodes: { cardId: string; gameId: string; setId: string }[] } }>(`
    query AllCardsForPages {
      allCard {
        nodes {
          cardId
          gameId
          setId
        }
      }
    }
  `)
  if (cardResult.errors) throw cardResult.errors
  const cardNodes = cardResult.data?.allCard.nodes ?? []
  for (const c of cardNodes) {
    createPage({
      path: `/games/${c.gameId}/cards/${c.cardId}/`,
      component: cardDetail,
      context: { gameId: c.gameId, cardId: c.cardId, setId: c.setId },
    })
  }

  // Set-detail pages ------------------------------------------------------
  const setResult = await graphql<{ allCardSet: { nodes: { setId: string; gameId: string }[] } }>(`
    query AllCardSetsForPages {
      allCardSet {
        nodes {
          setId
          gameId
        }
      }
    }
  `)
  if (setResult.errors) throw setResult.errors
  const setNodes = setResult.data?.allCardSet.nodes ?? []
  for (const s of setNodes) {
    createPage({
      path: `/games/${s.gameId}/sets/${s.setId}/`,
      component: setDetail,
      context: { gameId: s.gameId, setId: s.setId },
    })
  }

  reporter.info(
    `[tcgdb] Created pages: ${games.length} game homes, ` +
      `${games.length} card indexes, ${cardNodes.length} card details, ` +
      `${games.length} set indexes, ${setNodes.length} set details.`
  )

  // Redirects -------------------------------------------------------------
  const redirects = readJson<RedirectRecord[]>('redirects.json')
  for (const r of redirects) {
    createRedirect({
      fromPath: r.from,
      toPath: r.to,
      isPermanent: r.isPermanent ?? true,
    })
  }
  if (redirects.length > 0) {
    reporter.info(`[tcgdb] Registered ${redirects.length} redirects.`)
  }
}
