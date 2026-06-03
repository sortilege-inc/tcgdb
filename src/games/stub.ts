import type { Deck } from '../types/data'
import type {
  CardLookup,
  DeckSection,
  GameModule,
  ValidationIssue,
} from './_types'

export function makeStubModule(gameId: string): GameModule {
  return {
    gameId,
    validate: ({ deck, lookup }) => {
      const warnings: ValidationIssue[] = [
        {
          rule: 'unimplemented',
          message: `Deck validation for ${gameId} is not yet implemented.`,
        },
      ]
      // Surface errata state so the user can see the deck's `enforceErrata`
      // toggle has an effect even before a real validator exists.
      const erratedIds: string[] = []
      for (const entries of Object.values(deck.zones)) {
        for (const e of entries) {
          const card = lookup.get(e.cardId)
          if (card && (card as { errata?: unknown }).errata) erratedIds.push(e.cardId)
        }
      }
      if (erratedIds.length > 0) {
        warnings.push({
          rule: deck.enforceErrata ? 'errata-enforced' : 'errata-available',
          message: deck.enforceErrata
            ? `Errata enforced for ${erratedIds.length} card${erratedIds.length === 1 ? '' : 's'} in this deck. Effective text/stats reflect the revisions.`
            : `Errata available but NOT enforced for ${erratedIds.length} card${erratedIds.length === 1 ? '' : 's'}. Toggle "Enforce errata" to apply.`,
          cardIds: erratedIds,
        })
      }
      return { valid: true, errors: [], warnings }
    },
    searchableFields: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'type', label: 'Type', type: 'string' },
    ],
    buildSearchPredicate: (q) => (card) => {
      if (!q.freeText) return true
      return card.name.toLowerCase().includes(q.freeText.toLowerCase())
    },
    deckSections: (deck, lookup) => groupByType(deck, lookup),
    primaryCard: () => null,
    computeDeckStats: () => [],
    cardDisplaySchema: [
      { key: 'name', label: 'Name', format: 'text' },
      { key: 'type', label: 'Type', format: 'text' },
      { key: 'text', label: 'Text', format: 'text', hideIfEmpty: true },
    ],
    expectedCopiesPerBox: () => 3,
  }
}

function groupByType(deck: Deck, lookup: CardLookup): DeckSection[] {
  const buckets = new Map<string, { cardId: string; qty: number }[]>()
  for (const entries of Object.values(deck.zones)) {
    for (const entry of entries) {
      const card = lookup.get(entry.cardId)
      const key = card?.type ?? 'Unknown'
      const list = buckets.get(key) ?? []
      list.push(entry)
      buckets.set(key, list)
    }
  }
  return Array.from(buckets, ([title, cardEntries]) => ({
    title: `${title} (${cardEntries.reduce((n, e) => n + e.qty, 0)})`,
    cardEntries,
  }))
}
