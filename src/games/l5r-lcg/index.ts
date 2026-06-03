import { makeStubModule } from '../stub'
import type { GameModule, SearchFieldSpec, CardDisplayField } from '../_types'
import type { Card, CardSet } from '../../types/data'

const L5R_TYPES = [
  'Stronghold',
  'Province',
  'Role',
  'Character',
  'Event',
  'Attachment',
  'Holding',
  'Warlord',
  'treaty',
]

const L5R_CLANS = [
  'Crab',
  'Crane',
  'Dragon',
  'Lion',
  'Phoenix',
  'Scorpion',
  'Unicorn',
  'Neutral',
  'Shadowlands',
]

const L5R_DECKS = ['dynasty', 'conflict']

const searchableFields: SearchFieldSpec[] = [
  { key: 'name', label: 'Name', type: 'string', operators: ['contains', 'eq', 'startsWith'] },
  { key: 'type', label: 'Type', type: 'enum', enumValues: L5R_TYPES, operators: ['eq', 'in'] },
  { key: 'clan', label: 'Clan', type: 'enum', enumValues: L5R_CLANS, operators: ['eq', 'in'] },
  { key: 'deck', label: 'Deck', type: 'enum', enumValues: L5R_DECKS, operators: ['eq'] },
  { key: 'setId', label: 'Set', type: 'string', operators: ['eq'] },
]

const cardDisplaySchema: CardDisplayField[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'clan', label: 'Clan', hideIfEmpty: true },
  { key: 'deck', label: 'Deck', hideIfEmpty: true },
  { key: 'illustrator', label: 'Illustrator', hideIfEmpty: true },
]

// -------------------------------------------------------------------------
// Per-box expected-copy rule, ported from unsorted/build_app.py.
//
// One box of each set ships a known card-by-card distribution. This rule
// returns that per-box expected count given a card and its set.
// -------------------------------------------------------------------------

const ALWAYS_SINGLETON_TYPES = new Set(['Role', 'Warlord', 'treaty'])

/** Cycles + categories where Strongholds and Provinces ship as singletons. */
const SINGLETON_S_P_CYCLES = new Set([
  'Inheritance Cycle',
  'Dominion Cycle',
  'Temptations Cycle',
])
const SINGLETON_S_P_SET_TYPES = new Set(['clan-pack', 'premium'])

function isStrongholdOrProvince(type: string): boolean {
  return type === 'Stronghold' || type === 'Province'
}

function coreBoxExpected(cardType: string, clan: string | undefined): number {
  if (cardType === 'Province' || cardType === 'Stronghold' || cardType === 'Role') return 1
  if (clan === 'Neutral') return 3
  return 1 // clan-specific Character/Event/Attachment/Holding
}

function expectedCopiesPerBox(card: Card, set: CardSet): number {
  if (set.type === 'core') {
    return coreBoxExpected(card.type, card.clan as string | undefined)
  }
  if (ALWAYS_SINGLETON_TYPES.has(card.type)) return 1

  // Clan War is the only set where provinces are 2 per box.
  if (set.name === 'Clan War' && card.type === 'Province') return 2

  if (isStrongholdOrProvince(card.type)) {
    if (SINGLETON_S_P_SET_TYPES.has(set.type)) return 1
    if (set.cycle && SINGLETON_S_P_CYCLES.has(set.cycle)) return 1
    // Imperial / Elemental Cycle strongholds and provinces stay at 3.
  }
  return 3
}

const base = makeStubModule('l5r-lcg')

export const l5rModule: GameModule = {
  ...base,
  searchableFields,
  cardDisplaySchema,
  expectedCopiesPerBox,
}
