import * as React from 'react'
import { graphql, Link, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'
import { getGameModule } from '../games/registry'
import { erratafDiff } from '../lib/errata'
import type { CardDisplayField } from '../games/_types'

interface PageContext {
  gameId: string
  cardId: string
}

interface CardRulingNode {
  date?: string | null
  source?: string | null
  sourceUrl?: string | null
  text?: string | null
}

interface CardNode {
  cardId: string
  nameAscii?: string | null
  traitsAscii?: string[] | null
  gameId: string
  setId: string
  publisherId: string
  name: string
  type: string
  unique?: boolean | null
  text?: string | null
  flavorText?: string | null
  illustrator?: string | null
  unverified?: boolean | null
  clan?: string | null
  deck?: string | null
  faction?: string | null
  side?: string | null
  cost?: number | null
  strength?: number | null
  influence?: number | null
  military?: string | null
  political?: string | null
  militaryBonus?: string | null
  politicalBonus?: string | null
  glory?: number | null
  honor?: number | null
  fate?: number | null
  influencePool?: number | null
  element?: string | null
  traits?: string[] | null
  errata?: Record<string, unknown> | null
  rulings?: CardRulingNode[] | null
}

interface SetNode {
  setId: string
  name: string
  cycle?: string | null
  type: string
}

interface Data {
  card: CardNode | null
  cardSet: SetNode | null
}

export default function CardDetailPage(
  props: PageProps<Data, PageContext>
): React.ReactElement {
  const { gameId, cardId } = props.pageContext
  const game = getGame(gameId)
  const module = getGameModule(gameId)
  const card = props.data.card
  const set = props.data.cardSet

  if (!card) {
    return (
      <>
        <h1>Card not found</h1>
        <p>
          No card with id <code>{cardId}</code> in <code>{gameId}</code>.{' '}
          <Link to={`/games/${gameId}/cards/`}>Back to cards.</Link>
        </p>
      </>
    )
  }

  const schema: CardDisplayField[] = module?.cardDisplaySchema ?? []
  const cardRecord = card as unknown as Record<string, unknown>

  return (
    <>
      <header style={{ marginBottom: '1.5rem' }}>
        <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>
          <Link to={`/games/${gameId}/cards/`}>
            {game?.shortName ?? game?.name ?? gameId} cards
          </Link>{' '}
          / <span>{card.cardId}</span>
        </div>
        <h1 style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span>
            {card.unique ? '◆ ' : ''}
            {card.name}
          </span>
          {card.unverified && (
            <span
              title="Unverified — details came from an external scrape and haven't been confirmed against the printed card."
              style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                border: '1px dashed var(--theme-border)',
                borderRadius: 999,
                opacity: 0.7,
                fontWeight: 400,
                cursor: 'help',
              }}
            >
              unverified
            </span>
          )}
        </h1>
        <div style={{ opacity: 0.7 }}>{card.type}</div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 320px)',
          gap: '2rem',
          alignItems: 'start',
        }}
      >
        <section>
          <h2 style={{ fontSize: '1rem', opacity: 0.7, marginBottom: '0.5rem' }}>
            Fields
          </h2>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '0.4rem 1rem',
            }}
          >
            {schema.map((f) => {
              const value = cardRecord[f.key]
              if (
                f.hideIfEmpty &&
                (value === null || value === undefined || value === '')
              ) {
                return null
              }
              return (
                <React.Fragment key={f.key}>
                  <dt style={{ opacity: 0.6 }}>{f.label}</dt>
                  <dd>{value == null || value === '' ? '—' : String(value)}</dd>
                </React.Fragment>
              )
            })}
          </dl>

          {card.text && (
            <section style={{ marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', opacity: 0.7, marginBottom: '0.5rem' }}>Text</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{card.text}</p>
            </section>
          )}
          {card.flavorText && (
            <section style={{ marginTop: '1rem' }}>
              <p style={{ fontStyle: 'italic', opacity: 0.85 }}>{card.flavorText}</p>
            </section>
          )}

          {/* Errata diff */}
          {(() => {
            const diff = erratafDiff(card as unknown as Parameters<typeof erratafDiff>[0])
            if (diff.length === 0) return null
            return (
              <section
                style={{
                  marginTop: '1.5rem',
                  background: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  borderLeft: '4px solid #d76a2a',
                  borderRadius: 6,
                  padding: '0.75rem 1rem',
                }}
              >
                <h2 style={{ fontSize: '1rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                  Errata <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.85rem' }}>
                    (applied when a deck enforces errata)
                  </span>
                </h2>
                <ul style={{ listStyle: 'none', display: 'grid', gap: '0.4rem' }}>
                  {diff.map((d) => (
                    <li key={d.field}>
                      <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>{d.field}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'baseline' }}>
                        <span style={{ opacity: 0.6, textDecoration: 'line-through' }}>
                          {formatVal(d.before)}
                        </span>
                        <span aria-hidden style={{ opacity: 0.5 }}>→</span>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{formatVal(d.after)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })()}

          {/* Rulings */}
          {card.rulings && card.rulings.length > 0 && (
            <section
              style={{
                marginTop: '1.5rem',
                background: 'var(--theme-surface)',
                border: '1px solid var(--theme-border)',
                borderLeft: '4px solid var(--theme-primary)',
                borderRadius: 6,
                padding: '0.75rem 1rem',
              }}
            >
              <h2 style={{ fontSize: '1rem', opacity: 0.8, marginBottom: '0.5rem' }}>Rulings</h2>
              <ul style={{ listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
                {card.rulings.map((r, i) => (
                  <li key={i} style={{ paddingBottom: '0.5rem', borderBottom: i < card.rulings!.length - 1 ? '1px solid var(--theme-border)' : 'none' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', opacity: 0.7, fontSize: '0.8rem', marginBottom: '0.15rem' }}>
                      {r.date && <span>{r.date}</span>}
                      {r.source && <span>· {r.source}</span>}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{r.text}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>

        <aside
          style={{
            background: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
            borderLeft: `4px solid var(--theme-primary)`,
            borderRadius: 8,
            padding: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1rem', opacity: 0.7, marginBottom: '0.5rem' }}>Set</h2>
          {set ? (
            <>
              <div>
                <Link to={`/games/${gameId}/sets/${set.setId}/`}>{set.name}</Link>
              </div>
              <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>{set.type}</div>
              {set.cycle && (
                <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>{set.cycle}</div>
              )}
            </>
          ) : (
            <div style={{ opacity: 0.6 }}>Unknown set.</div>
          )}
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ opacity: 0.6 }}>Publisher</div>
            <div>{card.publisherId}</div>
          </div>
        </aside>
      </div>
    </>
  )
}

function formatVal(v: unknown): string {
  if (v === undefined) return '—'
  if (v === null) return '—'
  if (v === '') return '(empty)'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (Array.isArray(v)) return v.length === 0 ? '—' : v.join(' · ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export const Head: HeadFC<Data, PageContext> = ({ data }) => {
  const card = data.card
  return <title>{card ? `${card.name} · tcgdb` : 'Card · tcgdb'}</title>
}

export const query = graphql`
  query CardDetail($gameId: String!, $cardId: String!, $setId: String) {
    card(gameId: { eq: $gameId }, cardId: { eq: $cardId }) {
      cardId
      gameId
      setId
      publisherId
      name
      nameAscii
      type
      unique
      text
      flavorText
      illustrator
      unverified
      clan
      deck
      faction
      side
      cost
      strength
      influence
      military
      political
      militaryBonus
      politicalBonus
      glory
      honor
      fate
      influencePool
      element
      traits
      traitsAscii
      errata
      rulings {
        date
        source
        sourceUrl
        text
      }
    }
    cardSet(gameId: { eq: $gameId }, setId: { eq: $setId }) {
      setId
      name
      cycle
      type
    }
  }
`
