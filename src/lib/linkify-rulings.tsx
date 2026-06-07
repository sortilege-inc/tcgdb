/**
 * Render ruling/errata text with markdown-style links converted to React
 * nodes. Specifically:
 *
 *   [Card Name](https://fiveringsdb.com/card/some-slug)
 *
 *     → if the slug resolves to a card in our catalog for the given gameId,
 *       render as <CardLink/> (internal link with hover preview);
 *       otherwise fall back to an external <a/>.
 *
 *   [Some Text](https://fiveringsdb.com/rules/reference#anchor)
 *
 *     → render as an external <a target="_blank"/>.
 *
 *   Other [text](url) → external <a/>.
 *
 *   Plain text passes through as-is.
 */
import * as React from 'react'
import { CardLink } from '../components/CardLink'
import { useCardLookup } from './useCardLookup'

const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const FIVERINGSDB_CARD_RE = /^https?:\/\/(?:www\.)?fiveringsdb\.com\/card\/([a-z0-9-]+)/i

export function useLinkifyRulings(gameId: string): (text: string) => React.ReactNode {
  const lookup = useCardLookup()
  return React.useCallback((text: string) => linkifyOne(text, gameId, lookup), [gameId, lookup])
}

function linkifyOne(
  text: string,
  gameId: string,
  lookup: ReturnType<typeof useCardLookup>,
): React.ReactNode {
  if (!text || !text.includes('](')) return text   // fast path: no markdown links

  const out: React.ReactNode[] = []
  let lastIndex = 0
  let i = 0
  for (const m of text.matchAll(MD_LINK_RE)) {
    const [whole, label, url] = m
    const start = m.index ?? 0
    if (start > lastIndex) out.push(text.slice(lastIndex, start))

    const cardMatch = FIVERINGSDB_CARD_RE.exec(url!)
    if (cardMatch) {
      const slug = cardMatch[1]!
      const entry = lookup.getBySlug(gameId, slug)
      if (entry) {
        out.push(
          <CardLink key={`l${i}`} gameId={entry.gameId} cardId={entry.cardId} name={label}>
            {label}
          </CardLink>
        )
      } else {
        // Card not in our catalog (yet) — keep the original URL as an
        // external link rather than dropping the link entirely.
        out.push(<ExternalLink key={`l${i}`} href={url!} label={label!} />)
      }
    } else {
      out.push(<ExternalLink key={`l${i}`} href={url!} label={label!} />)
    }
    lastIndex = start + whole!.length
    i++
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex))
  return <>{out}</>
}

function ExternalLink({ href, label }: { href: string; label: string }): React.ReactElement {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  )
}
