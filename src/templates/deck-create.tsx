import * as React from 'react'
import { Link, navigate, type HeadFC, type PageProps } from 'gatsby'
import { getGame } from '../data/games'
import { useSidecarState } from '../state/SidecarStateProvider'

interface PageContext {
  gameId: string
}

export default function DeckCreatePage(
  props: PageProps<object, PageContext>
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const { createDeck, readOnly } = useSidecarState()

  const initialFormat = game?.formats?.[0]?.id ?? 'standard'
  const [name, setName] = React.useState('')
  const [formatId, setFormatId] = React.useState(initialFormat)
  const [origin, setOrigin] = React.useState<'own' | 'imported'>('own')
  const [importedFrom, setImportedFrom] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (readOnly) return
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const deck = await createDeck({
        gameId,
        formatId,
        name,
        origin,
        importedFrom: origin === 'imported' && importedFrom.trim() ? importedFrom : undefined,
        notes: notes.trim() || undefined,
      })
      void navigate(`/games/${gameId}/decks/${deck.id}/`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!game) {
    return (
      <>
        <h1>Unknown game</h1>
        <p><Link to="/">Back home.</Link></p>
      </>
    )
  }

  return (
    <>
      <header style={{ marginBottom: '1.5rem' }}>
        <Link to={`/games/${gameId}/decks/`} style={{ opacity: 0.7 }}>← Decks</Link>
        <h1 style={{ marginTop: '0.5rem' }}>New deck</h1>
        <p style={{ opacity: 0.7 }}>
          {game.shortName ?? game.name}. You can add cards on the deck page
          after it's created.
        </p>
        {readOnly && (
          <p style={{ color: '#e8755a' }}>
            Read-only build — cannot create decks.
          </p>
        )}
      </header>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 560 }}>
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Crab Aggro"
            required
            disabled={submitting || readOnly}
            style={inputStyle}
          />
        </Field>

        <Field label="Format">
          <select
            value={formatId}
            onChange={(e) => setFormatId(e.target.value)}
            disabled={submitting || readOnly}
            style={inputStyle}
          >
            {game.formats.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Origin">
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label>
              <input
                type="radio"
                checked={origin === 'own'}
                onChange={() => setOrigin('own')}
                disabled={submitting || readOnly}
              /> Own
            </label>
            <label>
              <input
                type="radio"
                checked={origin === 'imported'}
                onChange={() => setOrigin('imported')}
                disabled={submitting || readOnly}
              /> Imported
            </label>
          </div>
        </Field>

        {origin === 'imported' && (
          <Field label="Imported from">
            <input
              type="text"
              value={importedFrom}
              onChange={(e) => setImportedFrom(e.target.value)}
              placeholder="URL or description"
              disabled={submitting || readOnly}
              style={inputStyle}
            />
          </Field>
        )}

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="Plan, matchups, write-up…"
            disabled={submitting || readOnly}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </Field>

        {error && (
          <p style={{ color: '#e8755a' }}>Error: {error}</p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            disabled={submitting || readOnly || !name.trim()}
            style={{
              background: 'var(--theme-primary)',
              color: 'var(--theme-background)',
              border: 'none',
              padding: '0.5rem 1rem',
            }}
          >
            {submitting ? 'Creating…' : 'Create deck'}
          </button>
          <Link to={`/games/${gameId}/decks/`}>Cancel</Link>
        </div>
      </form>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.65rem',
  background: 'var(--theme-surface)',
  color: 'var(--theme-text)',
  border: '1px solid var(--theme-border)',
  borderRadius: 6,
  font: 'inherit',
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ opacity: 0.7, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{label}</div>
      {children}
    </label>
  )
}

export const Head: HeadFC<object, PageContext> = ({ pageContext }) => {
  const game = getGame(pageContext.gameId)
  return <title>{game ? `New deck · ${game.shortName ?? game.name} · tcgdb` : 'New deck · tcgdb'}</title>
}
