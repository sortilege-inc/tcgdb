import type { GameModule } from './_types'
import { l5rModule } from './l5r-lcg'
import { netrunnerModule } from './netrunner'
import { arkhamModule } from './arkham-lcg'
import { vampireRivalsModule } from './vampire-rivals'
import { vtesModule } from './vtes'
import { fleshAndBloodModule } from './flesh-and-blood'
import { lotrModule } from './lotr-lcg'
import { mtgModule } from './mtg'

export const GAME_MODULES: Record<string, GameModule> = {
  'l5r-lcg': l5rModule,
  'netrunner': netrunnerModule,
  'arkham-lcg': arkhamModule,
  'vampire-rivals': vampireRivalsModule,
  'vtes': vtesModule,
  'flesh-and-blood': fleshAndBloodModule,
  'lotr-lcg': lotrModule,
  'mtg': mtgModule,
}

export function getGameModule(gameId: string): GameModule | undefined {
  return GAME_MODULES[gameId]
}
