/**
 * Card-catalog lookup hook.
 *
 * Static query — Gatsby resolves the data at build time and inlines the
 * result, so the runtime cost is just an object reference plus the Map
 * construction. Used by CardLink (for hover preview) and the rulings
 * linkifier (to resolve fiveringsdb-style card references to internal
 * card pages).
 */
import { useStaticQuery, graphql } from 'gatsby'
import * as React from 'react'

export interface CardLookupEntry {
  cardId: string
  gameId: string
  name: string
  /** Slugified name (lowercased, hyphenated, apostrophe-stripped), used to
   *  resolve fiveringsdb.com/card/<slug> references back to a cardId. */
  slug: string
  imagePath?: string | null
}

interface QueryResult {
  allCard: { nodes: Array<{
    cardId: string
    gameId: string
    name: string
    imagePath: string | null
  }> }
}

export interface CardLookup {
  /** Lookup by (gameId, cardId). */
  get(gameId: string, cardId: string): CardLookupEntry | undefined
  /** Lookup by (gameId, name) — case-insensitive exact match on title. */
  getByName(gameId: string, name: string): CardLookupEntry | undefined
  /** Lookup by (gameId, slug) — handles fiveringsdb.com/card/<slug> form. */
  getBySlug(gameId: string, slug: string): CardLookupEntry | undefined
}

/** Slugify a card name the same way FiveRingsDB does: lowercase, drop
 *  apostrophes, replace any non-alphanumeric run with a single hyphen,
 *  trim leading/trailing hyphens. */
export function slugifyCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, '')  // straight + curly apostrophe
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip diacritics so Yōjimbō → yojimbo
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function useCardLookup(): CardLookup {
  const data: QueryResult = useStaticQuery(graphql`
    query CardLookupAll {
      allCard {
        nodes {
          cardId
          gameId
          name
          imagePath
        }
      }
    }
  `)

  // Build three lookup maps once per render; the underlying data is stable
  // across renders so React.useMemo keeps this work to one-time-per-mount.
  return React.useMemo<CardLookup>(() => {
    const byId    = new Map<string, CardLookupEntry>()
    const byName  = new Map<string, CardLookupEntry>()
    const bySlug  = new Map<string, CardLookupEntry>()
    for (const n of data.allCard.nodes) {
      const entry: CardLookupEntry = {
        cardId: n.cardId,
        gameId: n.gameId,
        name: n.name,
        slug: slugifyCardName(n.name),
        imagePath: n.imagePath ?? undefined,
      }
      byId.set(`${entry.gameId}|${entry.cardId}`, entry)
      byName.set(`${entry.gameId}|${entry.name.toLowerCase()}`, entry)
      bySlug.set(`${entry.gameId}|${entry.slug}`, entry)
    }
    return {
      get: (gameId, cardId) => byId.get(`${gameId}|${cardId}`),
      getByName: (gameId, name) => byName.get(`${gameId}|${name.toLowerCase()}`),
      getBySlug: (gameId, slug) => bySlug.get(`${gameId}|${slug.toLowerCase()}`),
    }
  }, [data])
}
