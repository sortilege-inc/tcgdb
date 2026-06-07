/**
 * Shared types + helpers for L5R deck validators.
 *
 * Every validator is a pure function taking { deck, format, lookup, parsed }
 * and returning issues. The composite in ../validate.ts assembles them.
 */
import type { Deck } from '../../../types/data'
import type { CardLookup, ValidationIssue } from '../../_types'

// The Card shape (from src/types/data.ts) carries all L5R-relevant fields,
// but at the GameModule layer it's typed as the generic `Card`. We re-export
// a narrowed local view that surfaces the fields the validators consume.
export interface L5RCard {
  id: string
  name: string
  type: string
  unique?: boolean
  clan?: string
  deck?: string
  text?: string
  cost?: number
  strength?: number
  influence?: number | null
  influencePool?: number
  // Province-only
  elements?: string[]
  // Stronghold-only
  fateIncome?: number
  honor?: number
  // Role-only
  roleClassifier?: 'keeper' | 'seeker' | 'support' | 'other'
  roleRing?: 'air' | 'earth' | 'fire' | 'water' | 'void'
  roleClan?: string
  influenceBonus?: number
  forcesSplashClan?: string
  // Universal deckbuilding metadata
  deckLimit?: number
  legalIn?: {
    standard?: 'legal' | 'restricted' | 'banned'
    stronghold?: 'legal' | 'restricted' | 'banned'
    skirmish?: 'legal' | 'restricted' | 'banned'
  }
  roleRestriction?: {
    ring?: 'air' | 'earth' | 'fire' | 'water' | 'void'
    type?: 'keeper' | 'seeker' | 'support'
    clan?: string
  }
}

export interface DeckEntry {
  card: L5RCard
  qty: number
  zoneId: string
}

/** Deck zones bucketed into the semantically-typed slots L5R uses. */
export interface ParsedDeck {
  stronghold: L5RCard | null
  role: L5RCard | null
  /** Province cards (max 5 in a valid deck). */
  provinces: L5RCard[]
  /** Dynasty deck cards with quantities. */
  dynasty: DeckEntry[]
  /** Conflict deck cards with quantities. */
  conflict: DeckEntry[]
  /** Everything we couldn't classify (unknown card types, missing lookups). */
  unrecognized: Array<{ cardId: string; qty: number; zoneId: string; reason: string }>
}

/** Bucket the deck's zone entries by their card type. We accept any zone
 *  layout because the wizard / importer may pack stronghold+role+provinces
 *  together OR split them across zones. The card.type field is the source
 *  of truth for routing. */
export function parseDeck(deck: Deck, lookup: CardLookup): ParsedDeck {
  const out: ParsedDeck = {
    stronghold: null,
    role: null,
    provinces: [],
    dynasty: [],
    conflict: [],
    unrecognized: [],
  }
  for (const [zoneId, entries] of Object.entries(deck.zones ?? {})) {
    for (const e of entries) {
      const raw = lookup.get(e.cardId)
      if (!raw) {
        out.unrecognized.push({ cardId: e.cardId, qty: e.qty, zoneId, reason: 'card not found in catalog' })
        continue
      }
      const c = raw as unknown as L5RCard
      switch (c.type) {
        case 'Stronghold':
          out.stronghold = c
          break
        case 'Role':
          out.role = c
          break
        case 'Province':
          // Provinces are singletons in deckbuilding — push each copy as one entry.
          for (let i = 0; i < (e.qty || 1); i++) out.provinces.push(c)
          break
        default: {
          // Route Dynasty / Conflict / etc. by the card's deck side.
          if (c.deck === 'dynasty') {
            out.dynasty.push({ card: c, qty: e.qty, zoneId })
          } else if (c.deck === 'conflict') {
            out.conflict.push({ card: c, qty: e.qty, zoneId })
          } else {
            out.unrecognized.push({
              cardId: e.cardId, qty: e.qty, zoneId,
              reason: `card type "${c.type}" has no deck side (deck=${JSON.stringify(c.deck)})`,
            })
          }
        }
      }
    }
  }
  return out
}

/** Standard issue constructors keep the rule keys consistent. */
export const issue = {
  error: (rule: string, message: string, extra?: Partial<ValidationIssue>): ValidationIssue =>
    ({ rule, message, ...extra }),
  warn: (rule: string, message: string, extra?: Partial<ValidationIssue>): ValidationIssue =>
    ({ rule, message, ...extra }),
}

/** A card is "in-clan" for the deck if its clan matches the primary clan
 *  (derived from the stronghold) or is Neutral. */
export function isInClanOrNeutral(card: L5RCard, primaryClan: string | null): boolean {
  if (card.clan === 'Neutral') return true
  if (primaryClan && card.clan === primaryClan) return true
  return false
}

/** Per RRG: dual-element provinces and Toshi Ranbo count toward each
 *  element they list. */
export function provinceElements(p: L5RCard): string[] {
  return (p.elements ?? []).map((s) => s.toLowerCase())
}
