/**
 * Dump every Province card to a CSV for hand-editing the element field.
 *
 *   Columns:
 *     cardId          — stable identifier (e.g. core-set-008)
 *     setId           — which set
 *     name            — printed name
 *     elements        — empty; user fills with one of:
 *                         air | earth | fire | water | void
 *                       For dual-element provinces, use a semicolon:
 *                         air;water
 *     text_hint       — first ~80 chars of card text; sometimes the element
 *                       is implied by phrases like "Water role only" or
 *                       "+2 strength while you have a Fire role".
 *
 *   Output: .tmp/provinces-to-fill.csv
 *
 *   Usage:
 *     tsx scripts/dump-provinces-csv.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(__dirname, '..')
const CARDS_DIR = path.join(PROJECT_ROOT, 'data', 'cards', 'l5r-lcg')
const OUT_PATH = path.join(PROJECT_ROOT, '.tmp', 'provinces-to-fill.csv')

interface CardLike {
  id: string
  setId: string
  type?: string
  name?: string
  text?: string
  elements?: string[]
  element?: string
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function hint(text: string | undefined): string {
  if (!text) return ''
  // Drop HTML tags and bracket tokens for the hint snippet.
  const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return clean.slice(0, 100)
}

function main(): void {
  const provinces: CardLike[] = []
  for (const f of fs.readdirSync(CARDS_DIR)) {
    if (!f.endsWith('.json')) continue
    const cards = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, f), 'utf-8')) as CardLike[]
    for (const c of cards) {
      if (c.type === 'Province') provinces.push(c)
    }
  }
  provinces.sort((a, b) => a.id.localeCompare(b.id))

  if (!fs.existsSync(path.dirname(OUT_PATH))) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  }

  const lines: string[] = []
  lines.push(['cardId', 'setId', 'name', 'elements', 'text_hint'].join(','))
  for (const p of provinces) {
    const existing = p.elements?.join(';') ?? p.element ?? ''
    lines.push([
      csvEscape(p.id),
      csvEscape(p.setId),
      csvEscape(p.name ?? ''),
      csvEscape(existing),
      csvEscape(hint(p.text)),
    ].join(','))
  }
  fs.writeFileSync(OUT_PATH, lines.join('\n') + '\n', 'utf-8')
  console.log(`wrote ${provinces.length} provinces to ${path.relative(PROJECT_ROOT, OUT_PATH)}`)
  console.log(`format reminder: elements column accepts air|earth|fire|water|void; semicolon for dual (e.g. air;water)`)
}

main()
