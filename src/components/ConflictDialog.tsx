import * as React from 'react'
import { Link } from 'gatsby'
import type { BuiltConflict } from '../state/sidecar-client'

interface Props {
  gameId: string
  conflicts: BuiltConflict[]
  /** Friendly framing — e.g. "Cannot mark this deck as built" */
  title: string
  /** Detail line before the per-card list. */
  description?: string
  /** Map of cardId -> display name for nicer rendering. Optional. */
  cardNames?: Record<string, string>
  onDismiss: () => void
}

export function ConflictDialog({
  gameId,
  conflicts,
  title,
  description,
  cardNames,
  onDismiss,
}: Props): React.ReactElement | null {
  if (!conflicts || conflicts.length === 0) return null

  // Group by deck for a more useful presentation.
  const byDeck = new Map<string, { deckId: string; deckName: string; cards: BuiltConflict[] }>()
  for (const c of conflicts) {
    for (const claim of c.claimedBy) {
      const existing = byDeck.get(claim.deckId)
      if (existing) {
        existing.cards.push(c)
      } else {
        byDeck.set(claim.deckId, {
          deckId: claim.deckId,
          deckName: claim.deckName,
          cards: [c],
        })
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--theme-surface)',
          border: '1px solid var(--theme-border)',
          borderLeft: '4px solid #c0392b',
          borderRadius: 8,
          maxWidth: 640,
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          padding: '1.25rem 1.5rem',
        }}
      >
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>{title}</h2>
        {description && (
          <p style={{ opacity: 0.8, marginBottom: '0.75rem', fontSize: '0.95rem' }}>{description}</p>
        )}

        <section style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', opacity: 0.7, marginBottom: '0.4rem' }}>
            Cards over-claimed
          </h3>
          <ul style={{ listStyle: 'none' }}>
            {conflicts.map((c) => (
              <li
                key={c.cardId}
                style={{
                  padding: '0.4rem 0',
                  borderBottom: '1px solid var(--theme-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <Link to={`/games/${gameId}/cards/${c.cardId}/`}>
                    {cardNames?.[c.cardId] ?? c.cardId}
                  </Link>
                  <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>
                    needs <strong>{c.demanded}</strong> · own <strong>{c.owned}</strong>{' '}
                    <span style={{ color: '#e8755a' }}>(short {c.shortfall})</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', opacity: 0.7, marginBottom: '0.4rem' }}>
            Decks involved
          </h3>
          <ul style={{ listStyle: 'none' }}>
            {Array.from(byDeck.values()).map((d) => (
              <li
                key={d.deckId}
                style={{
                  padding: '0.4rem 0',
                  borderBottom: '1px solid var(--theme-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <Link to={`/games/${gameId}/decks/${d.deckId}/`}>{d.deckName}</Link>
                <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>
                  uses {d.cards.length} affected card{d.cards.length === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p style={{ opacity: 0.7, fontSize: '0.85rem', marginTop: '0.75rem' }}>
          Resolve by unbuilding one of the conflicting decks or acquiring more
          copies of the affected cards.
        </p>

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onDismiss} style={{ padding: '0.4rem 0.85rem' }}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
