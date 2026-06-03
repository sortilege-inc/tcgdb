import gamesData from '../../data/games.json'
import type { Game } from '../types/data'

export const GAMES: Game[] = gamesData as Game[]

const GAME_BY_ID: Record<string, Game> = Object.fromEntries(
  GAMES.map((g) => [g.id, g])
)

export function getGame(gameId: string): Game | undefined {
  return GAME_BY_ID[gameId]
}
