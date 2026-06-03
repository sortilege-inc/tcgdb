// Canonical TypeScript shapes mirroring the on-disk JSON. Keep this file
// and data/ in sync; the entity IDs declared here are URL contracts.

export interface GameTheme {
  primary: string
  secondary?: string
  background?: string
  surface?: string
  text?: string
  accentMuted?: string
  font?: { body?: string; heading?: string }
  decorations?: Record<string, string>
}

export interface GamePublisher {
  publisherId: string
  status: 'official' | 'third-party'
  notes?: string
}

export interface Format {
  id: string
  name: string
  description?: string
}

export interface DeckZone {
  id: string
  name: string
  cardLimit?: { min?: number; max?: number }
  description?: string
}

export interface Game {
  id: string
  name: string
  shortName?: string
  status: 'stubbed' | 'partial' | 'complete'
  publishers: GamePublisher[]
  formats: Format[]
  deckZones: DeckZone[]
  iconRefs?: Record<string, string>
  theme: GameTheme
}

export interface Publisher {
  id: string
  name: string
  url?: string
  notes?: string
}

export interface CardSet {
  id: string
  gameId: string
  publisherId: string
  name: string
  type: string
  parentSetId?: string
  /** Game-specific grouping (e.g. L5R "Imperial Cycle"). Display only. */
  cycle?: string
  releaseDate?: string
  status: 'released' | 'preview' | 'announced'
  cardCount?: number
  legalIn?: string[]
  notes?: string
}

export interface Ruling {
  date: string
  source: string
  text: string
}

export interface Card {
  id: string
  gameId: string
  setId: string
  publisherId: string
  name: string
  type: string
  unique?: boolean
  text?: string
  flavorText?: string
  illustrator?: string
  imagePath?: string
  errata?: Partial<Card>
  rulings?: Ruling[]
  /**
   * Internal audit flag: this card's details came from an external/scraped
   * source (e.g. the L5R Fandom wiki CSV) and have not been confirmed
   * against the authoritative printed card. Cleared when the record is
   * replaced with authoritative data via an import/paste. Surfaced in
   * Settings → Audit.
   */
  unverified?: boolean
  /**
   * If this card is one face of a physical two-sided card, the cardId of
   * the other side. Used by L5R Under Fu Leng's Shadow co-op variants
   * (1A/1B, 2A/2B, 3A/3B) and Core Set Keeper/Seeker role pairs.
   * Bidirectional: both sides should set this to point at each other.
   * Collection counting treats both sides as the same physical card —
   * that semantic decision lives in the collection / inventory layer,
   * not here.
   */
  flipSideOf?: string
  [gameField: string]: unknown
}

export interface CollectionEntry {
  qty: number
  promoQty: number
  notes?: string
  /**
   * Internal audit flag: this entry's numbers came from an external/imported
   * source that has not been confirmed against the physical cards. Manual
   * mutation through the sidecar clears this — the act of editing is the
   * confirmation. Surfaced in the Settings → Audit view.
   */
  unverified?: boolean
}

export interface DeckEntry {
  cardId: string
  qty: number
}

export type PublisherFilter =
  | { mode: 'official-only' }
  | { mode: 'include-third-party' }
  | { mode: 'custom'; allowedPublisherIds: string[] }

export interface Deck {
  id: string
  gameId: string
  formatId: string
  name: string
  origin: 'own' | 'imported'
  importedFrom?: string
  zones: Record<string, DeckEntry[]>
  built: boolean
  enforceErrata: boolean
  publisherFilter: PublisherFilter
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PriceEntry {
  cardId: string
  date: string
  value: number
  currency?: string
  source: string
  notes?: string
}

export interface WishlistEntry {
  id: string
  kind: 'card' | 'product'
  gameId: string
  targetId: string
  desiredQty?: number
  priority?: number
  notes?: string
  addedAt: string
}

export interface GameLogEntry {
  id: string
  gameId: string
  date: string
  deckIds: string[]
  result?: 'win' | 'loss' | 'draw'
  notes?: string
}

export interface SellListItem {
  gameId: string
  cardId: string
  qty: number
  askingPrice?: number
  currency?: string
}

export interface SellList {
  id: string
  name: string
  createdAt: string
  items: SellListItem[]
}

export interface MutableState {
  collection: Record<string, Record<string, CollectionEntry>>
  decks: Deck[]
  prices: Record<string, PriceEntry[]>
  notes: GameLogEntry[]
  wishlist: WishlistEntry[]
  sellLists: SellList[]
}
