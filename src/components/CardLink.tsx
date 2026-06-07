/**
 * Card-page link with a hover-triggered image preview.
 *
 * Drop-in replacement for `<Link to={`/games/${gameId}/cards/${cardId}/`} />`.
 * On mouse-enter (after a short delay to avoid flicker on quick mouse-passes
 * across a list), shows the card's image in a fixed-position popover near
 * the cursor. Hides on mouse-leave or when the link is clicked.
 *
 * Usage:
 *   <CardLink gameId="l5r-lcg" cardId="core-set-052">Doji Hotaru</CardLink>
 *
 * If `name` and `imagePath` aren't passed, they're resolved from the
 * useCardLookup catalog. Passing them explicitly skips the lookup —
 * useful in hot lists like the cards-index table where the parent already
 * has the data.
 */
import * as React from 'react'
import { Link } from 'gatsby'
import { useCardLookup } from '../lib/useCardLookup'

interface Props {
  gameId: string
  cardId: string
  /** Display text. Defaults to the catalog name. */
  name?: string
  /** Image path for the hover preview. Defaults to the catalog imagePath. */
  imagePath?: string | null
  /** Extra link style. */
  style?: React.CSSProperties
  /** Override the default text rendering. */
  children?: React.ReactNode
}

const HOVER_DELAY_MS = 120
const PREVIEW_WIDTH  = 280

export function CardLink({
  gameId, cardId, name, imagePath, style, children,
}: Props): React.ReactElement {
  const lookup = useCardLookup()
  const entry = lookup.get(gameId, cardId)
  const displayName = name ?? entry?.name ?? cardId
  const previewSrc  = imagePath ?? entry?.imagePath ?? null

  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const onMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (!previewSrc) return
    const x = e.clientX, y = e.clientY
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setPos({ x, y }), HOVER_DELAY_MS)
  }
  const onMouseMove = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (pos) setPos({ x: e.clientX, y: e.clientY })
  }
  const onMouseLeave = (): void => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setPos(null)
  }
  const onClick = (): void => {
    // Hide the preview on click — the user is navigating away.
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setPos(null)
  }

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return (
    <>
      <Link
        to={`/games/${gameId}/cards/${cardId}/`}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        style={style}
      >
        {children ?? displayName}
      </Link>
      {pos && previewSrc && (
        <HoverPreview src={previewSrc} alt={displayName} clientX={pos.x} clientY={pos.y} />
      )}
    </>
  )
}

interface HoverPreviewProps {
  src: string
  alt: string
  clientX: number
  clientY: number
}

function HoverPreview({ src, alt, clientX, clientY }: HoverPreviewProps): React.ReactElement | null {
  // Position the preview: prefer to the right of the cursor, but flip to
  // the left if it would overflow the viewport. Vertically: anchor near
  // the cursor, but clamp inside the viewport.
  if (typeof window === 'undefined') return null
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  const previewH  = PREVIEW_WIDTH * 1.4   // L5R cards are roughly 2.5:3.5; close enough
  const gap = 16

  let left = clientX + gap
  if (left + PREVIEW_WIDTH > viewportW - 8) {
    left = clientX - gap - PREVIEW_WIDTH
  }
  if (left < 8) left = 8

  let top = clientY - previewH / 2
  if (top + previewH > viewportH - 8) top = viewportH - previewH - 8
  if (top < 8) top = 8

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left,
        top,
        width: PREVIEW_WIDTH,
        zIndex: 9999,
        pointerEvents: 'none',
        boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        borderRadius: 8,
        background: 'var(--theme-surface, #181b22)',
        border: '1px solid var(--theme-border, #2a2f39)',
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: 8,
        }}
        loading="eager"
      />
    </div>
  )
}
