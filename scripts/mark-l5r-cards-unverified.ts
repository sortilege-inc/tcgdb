/**
 * One-shot: stamp `unverified: true` on every L5R card record currently
 * in data/cards/l5r-lcg/*.json.
 *
 * The initial import populated these from the Fandom wiki CSV (only name,
 * type, clan, deck). Those details haven't been confirmed against the
 * printed cards. As authoritative card details are pasted in per-set, the
 * `unverified` flag is dropped on each replaced record.
 *
 * Idempotent: re-running just re-stamps.
 *
 * Run: npm run mark:l5r-unverified
 */
import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(__dirname, '..')
const CARDS_DIR = path.join(PROJECT_ROOT, 'data', 'cards', 'l5r-lcg')

interface Card {
  id: string
  unverified?: boolean
  [k: string]: unknown
}

function main(): void {
  if (!fs.existsSync(CARDS_DIR)) {
    console.error(`[mark-unverified] L5R card directory not found: ${CARDS_DIR}`)
    process.exit(1)
  }
  let totalFiles = 0
  let totalCards = 0
  let stamped = 0
  for (const fname of fs.readdirSync(CARDS_DIR)) {
    if (!fname.endsWith('.json')) continue
    const file = path.join(CARDS_DIR, fname)
    const cards = JSON.parse(fs.readFileSync(file, 'utf-8')) as Card[]
    let touched = false
    for (const c of cards) {
      totalCards++
      if (c.unverified !== true) {
        c.unverified = true
        stamped++
        touched = true
      }
    }
    if (touched) {
      fs.writeFileSync(file, JSON.stringify(cards, null, 2) + '\n', 'utf-8')
    }
    totalFiles++
  }
  console.log(`[mark-unverified] Scanned ${totalCards} cards across ${totalFiles} set files.`)
  console.log(`[mark-unverified] Stamped ${stamped} as unverified (others were already flagged).`)
}

main()
