import type { Card, Deck, Format, CardSet } from '../types/data'

export interface CardLookup {
  get(cardId: string): Card | undefined
  getMany(ids: string[]): Card[]
}

export interface ValidateInput {
  deck: Deck
  format: Format
  lookup: CardLookup
  ownedCounts?: Record<string, number>
}

export interface ValidationIssue {
  rule: string
  message: string
  zoneId?: string
  cardIds?: string[]
  details?: Record<string, unknown>
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export type SearchOperator =
  | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'contains' | 'startsWith' | 'in' | 'notIn'

export interface SearchFieldSpec {
  key: string
  label: string
  type: 'string' | 'number' | 'enum' | 'boolean' | 'set'
  enumValues?: string[]
  operators?: SearchOperator[]
}

export interface SearchTerm {
  field: string
  op: SearchOperator
  value: unknown
}

export interface SearchQuery {
  terms: SearchTerm[]
  freeText?: string
}

export interface DeckSection {
  title: string
  cardEntries: { cardId: string; qty: number }[]
}

export interface DeckStat {
  key: string
  label: string
  value: string | number
  warning?: boolean
}

export interface CardDisplayField {
  key: string
  label: string
  format?: 'text' | 'cost' | 'faction' | 'influencePips' | 'icons' | 'html'
  hideIfEmpty?: boolean
}

export interface DeckImporter {
  id: string
  label: string
  acceptsText: boolean
  acceptsUrl: boolean
  parse(input: string): Promise<Deck>
}

export interface GameModule {
  gameId: string
  validate(input: ValidateInput): ValidationResult
  searchableFields: SearchFieldSpec[]
  buildSearchPredicate(query: SearchQuery): (card: Card) => boolean
  deckSections(deck: Deck, lookup: CardLookup): DeckSection[]
  primaryCard(deck: Deck, lookup: CardLookup): { zoneId: string; cardId: string } | null
  computeDeckStats(deck: Deck, format: Format, lookup: CardLookup): DeckStat[]
  cardDisplaySchema: CardDisplayField[]
  expectedCopiesPerBox(card: Card, set: CardSet): number
  importers?: DeckImporter[]
}
