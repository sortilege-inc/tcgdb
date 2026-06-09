import * as React from 'react'
import { graphql, Link, navigate, type HeadFC, type PageProps } from 'gatsby'
import { getGame, publishersForGame, buildPublisherFilter, matchesPublisherFilter } from '../data/games'
import { useSidecarState } from '../state/SidecarStateProvider'

interface PageContext {
  gameId: string
}

interface StrongholdNode {
  cardId: string
  name: string
  clan: string | null
  setId: string
  publisherId: string
}

interface RoleNode {
  cardId: string
  name: string
  clan: string | null
  setId: string
  publisherId: string
  roleClassifier?: string | null
  roleRing?: string | null
  roleClan?: string | null
  forcesSplashClan?: string | null
  influenceBonus?: number | null
}

interface SetNode {
  setId: string
  name: string
}

interface Data {
  allStrongholds: { nodes: StrongholdNode[] }
  allRoles: { nodes: RoleNode[] }
  allCardSet: { nodes: SetNode[] }
}

// L5R clans in display order. Matches the chips used elsewhere.
const CLANS = ['Crab', 'Crane', 'Dragon', 'Lion', 'Phoenix', 'Scorpion', 'Unicorn'] as const
const CLAN_ACCENT: Record<string, { abbr: string; color: string }> = {
  Crab:     { abbr: 'CB', color: '#3a6cd0' },
  Crane:    { abbr: 'CR', color: '#5db3d6' },
  Dragon:   { abbr: 'DR', color: '#3fa86b' },
  Lion:     { abbr: 'LI', color: '#d4b14a' },
  Phoenix:  { abbr: 'PH', color: '#d36637' },
  Scorpion: { abbr: 'SC', color: '#b22e2e' },
  Unicorn:  { abbr: 'UN', color: '#7c4ec4' },
}

type Clan = (typeof CLANS)[number]

// Treat the role's name as the source of truth for grouping (the `clan` field
// on roles is whichever clan happens to print the role, not "what kind of role
// this is"). Anything matching "Support of the X" goes in the supports group;
// everything else is Keeper/Seeker.
function isSupportRole(name: string): boolean {
  return /^Support of the\b/i.test(name)
}

export default function DeckCreatePage(
  props: PageProps<Data, PageContext>
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const { createDeck, readOnly } = useSidecarState()

  const strongholds = props.data.allStrongholds.nodes
  const roles = props.data.allRoles.nodes
  const setNames = React.useMemo(
    () => Object.fromEntries(props.data.allCardSet.nodes.map((s) => [s.setId, s.name] as const)),
    [props.data.allCardSet.nodes]
  )

  const defaultFormat = game?.formats?.[0]?.id ?? 'stronghold'

  const [name, setName] = React.useState('')
  const [formatId, setFormatId] = React.useState(defaultFormat)
  const [clan, setClan] = React.useState<Clan | ''>('')
  const [strongholdId, setStrongholdId] = React.useState('')
  const [roleId, setRoleId] = React.useState('')
  // null = the user explicitly chose "no splash" (mono-clan).
  // undefined = the user hasn't decided yet — gets auto-set on first
  //              out-of-clan card add in the editor.
  const [splashClan, setSplashClan] = React.useState<string | null | undefined>(undefined)
  const [notes, setNotes] = React.useState('')
  const [origin, setOrigin] = React.useState<'own' | 'imported'>('own')
  const [importedFrom, setImportedFrom] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Publisher filter — multi-select of publisher IDs. Default to all
  // publishers registered for the game (= no filter applied). Cards
  // from non-selected publishers are HIDDEN from stronghold / role
  // pickers here and from the deck editor's card search later.
  const gamePublishers = React.useMemo(
    () => publishersForGame(gameId),
    [gameId]
  )
  const [selectedPublishers, setSelectedPublishers] = React.useState<string[]>(
    () => gamePublishers.map((p) => p.publisher.id)
  )
  const publisherFilter = React.useMemo(
    () => buildPublisherFilter(gameId, selectedPublishers),
    [gameId, selectedPublishers]
  )
  function togglePublisher(pubId: string): void {
    setSelectedPublishers((curr) => {
      if (curr.includes(pubId)) {
        // Don't allow deselecting all — leave at least one.
        if (curr.length === 1) return curr
        return curr.filter((id) => id !== pubId)
      }
      return [...curr, pubId]
    })
  }

  // When clan changes, drop the selected stronghold if it no longer matches.
  React.useEffect(() => {
    if (!clan || !strongholdId) return
    const sh = strongholds.find((s) => s.cardId === strongholdId)
    if (sh && sh.clan !== clan) setStrongholdId('')
  }, [clan, strongholdId, strongholds])

  // When the selected role forces a splash clan (Support of [Clan]),
  // adopt it; when the role changes away from a forcing role, leave the
  // user's previous pick alone unless it conflicts.
  const selectedRole = React.useMemo(
    () => roles.find((r) => r.cardId === roleId) ?? null,
    [roles, roleId]
  )
  const forcedSplashClan = selectedRole?.forcesSplashClan ?? null
  React.useEffect(() => {
    if (forcedSplashClan) setSplashClan(forcedSplashClan)
  }, [forcedSplashClan])

  // Apply publisher filter to stronghold / role pools BEFORE the
  // clan filter — if the user excludes a publisher, none of its
  // strongholds or roles should appear regardless of clan.
  const publisherFilteredStrongholds = React.useMemo(
    () => strongholds.filter((s) => matchesPublisherFilter(s, publisherFilter, gameId)),
    [strongholds, publisherFilter, gameId]
  )
  const publisherFilteredRoles = React.useMemo(
    () => roles.filter((r) => matchesPublisherFilter(r, publisherFilter, gameId)),
    [roles, publisherFilter, gameId]
  )

  // If the publisher filter excludes the currently-selected
  // stronghold or role, clear it so we don't submit an invalid pick.
  React.useEffect(() => {
    if (strongholdId && !publisherFilteredStrongholds.some((s) => s.cardId === strongholdId)) {
      setStrongholdId('')
    }
    if (roleId && !publisherFilteredRoles.some((r) => r.cardId === roleId)) {
      setRoleId('')
    }
  }, [publisherFilteredStrongholds, publisherFilteredRoles, strongholdId, roleId])

  const strongholdsForClan = React.useMemo(() => {
    if (!clan) return []
    return publisherFilteredStrongholds
      .filter((s) => s.clan === clan)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [clan, publisherFilteredStrongholds])

  const rolesGrouped = React.useMemo(() => {
    const keeperSeeker = publisherFilteredRoles.filter((r) => !isSupportRole(r.name))
    const supports = publisherFilteredRoles.filter((r) => isSupportRole(r.name))
    keeperSeeker.sort((a, b) => a.name.localeCompare(b.name))
    supports.sort((a, b) => a.name.localeCompare(b.name))
    return { keeperSeeker, supports }
  }, [publisherFilteredRoles])

  // Default name suggestion as you make picks ("New Crab deck", etc.)
  const placeholderName = clan ? `New ${clan} deck` : 'My deck'
  const effectiveName = name.trim() || placeholderName

  const canSubmit =
    !readOnly &&
    !submitting &&
    !!formatId &&
    !!clan &&
    !!strongholdId &&
    !!roleId

  async function onSubmit(): Promise<void> {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const zones: Record<string, { cardId: string; qty: number }[]> = {
        stronghold: [
          { cardId: strongholdId, qty: 1 },
          { cardId: roleId, qty: 1 },
        ],
      }
      // Only send splashClan when the user has actually picked one (clan name
      // or null=mono-clan); undefined means "decide later" and we leave the
      // field unset on the deck so the editor can auto-populate it later.
      const resolvedSplash = forcedSplashClan ?? splashClan
      const deck = await createDeck({
        gameId,
        formatId,
        name: effectiveName,
        origin,
        importedFrom: origin === 'imported' && importedFrom.trim() ? importedFrom : undefined,
        notes: notes.trim() || undefined,
        zones,
        publisherFilter,
        ...(resolvedSplash ? { splashClan: resolvedSplash } : {}),
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

  // ----- Render -----

  return (
    <>
      <header style={{ marginBottom: '1.5rem' }}>
        <Link to={`/games/${gameId}/decks/`} style={{ opacity: 0.7 }}>← Decks</Link>
        <h1 style={{ marginTop: '0.5rem' }}>New deck</h1>
        <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
          Pick a format, clan, stronghold, and role. The deck opens in the editor
          with your stronghold and role already placed.
        </p>
        {readOnly && (
          <p style={{ color: '#e8755a' }}>
            Read-only build — cannot create decks.
          </p>
        )}
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); void onSubmit() }}
        style={{ display: 'grid', gap: '1.25rem', maxWidth: 760 }}
      >
        {/* Name field — kept light, since most decks get renamed in the editor. */}
        <Section
          step={0}
          title="Name"
          summary={name.trim() ? `“${name.trim()}”` : `(default: “${placeholderName}”)`}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholderName}
            disabled={submitting || readOnly}
            style={inputStyle}
          />
        </Section>

        {/* Step 1: Format */}
        <Section
          step={1}
          title="Format"
          required
          done={!!formatId}
          summary={game.formats.find((f) => f.id === formatId)?.name}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {game.formats.map((f) => {
              const active = formatId === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormatId(f.id)}
                  disabled={submitting || readOnly}
                  style={chipButtonStyle(active)}
                  title={f.description}
                >
                  {f.name}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Publisher filter — optional. Only shown when the game has
            more than one registered publisher. Cards from publishers
            not in the selection are hidden from this wizard's
            stronghold / role pickers and from the deck-detail editor's
            card search. Stored on the Deck record so it persists. */}
        {gamePublishers.length > 1 && (
          <Section
            step={0}
            title="Publishers"
            summary={(() => {
              const allCount = gamePublishers.length
              const selCount = selectedPublishers.length
              if (selCount === allCount) return 'All (no filter)'
              if (selCount === 1) return gamePublishers.find((p) => p.publisher.id === selectedPublishers[0])?.publisher.name ?? '1 selected'
              return `${selCount} of ${allCount}`
            })()}
          >
            <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', opacity: 0.75 }}>
              Filter which publishers&apos; cards can go in this deck. Cards from
              non-selected publishers won&apos;t appear in search results. You can
              change this later from the deck editor.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {gamePublishers.map((gp) => {
                const active = selectedPublishers.includes(gp.publisher.id)
                const onlyOneLeft = active && selectedPublishers.length === 1
                return (
                  <button
                    key={gp.publisher.id}
                    type="button"
                    onClick={() => togglePublisher(gp.publisher.id)}
                    disabled={submitting || readOnly || onlyOneLeft}
                    style={{
                      ...chipButtonStyle(active),
                      ...(onlyOneLeft ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
                    }}
                    title={onlyOneLeft
                      ? 'At least one publisher must remain selected.'
                      : (gp.notes ?? gp.publisher.notes ?? gp.publisher.name)}
                  >
                    {gp.publisher.name}
                    {gp.status === 'third-party' && (
                      <span style={{ marginLeft: '0.4rem', opacity: 0.7, fontSize: '0.75rem' }}>
                        (third-party)
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* Step 2: Clan */}
        <Section
          step={2}
          title="Clan"
          required
          done={!!clan}
          summary={clan ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <ClanBubble clan={clan} />
              {clan}
            </span>
          ) : undefined}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {CLANS.map((c) => {
              const active = clan === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setClan(c)}
                  disabled={submitting || readOnly}
                  style={{
                    ...chipButtonStyle(active),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    background: active ? CLAN_ACCENT[c].color : 'var(--theme-surface-2)',
                    color: active ? '#fff' : 'var(--theme-text)',
                    borderColor: active ? CLAN_ACCENT[c].color : 'var(--theme-border)',
                  }}
                >
                  <ClanBubble clan={c} inverted={active} />
                  {c}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Step 3: Stronghold */}
        <Section
          step={3}
          title="Stronghold"
          required
          done={!!strongholdId}
          summary={strongholds.find((s) => s.cardId === strongholdId)?.name}
        >
          {!clan ? (
            <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>
              Pick a clan above to see its strongholds.
            </p>
          ) : strongholdsForClan.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>
              No {clan} strongholds in the data yet.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'grid', gap: '0.3rem' }}>
              {strongholdsForClan.map((s) => {
                const active = strongholdId === s.cardId
                return (
                  <li key={s.cardId}>
                    <button
                      type="button"
                      onClick={() => setStrongholdId(s.cardId)}
                      disabled={submitting || readOnly}
                      style={radioRowStyle(active)}
                    >
                      <span style={radioDotStyle(active)} />
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <span style={{ opacity: 0.55, fontSize: '0.78rem' }}>
                        {setNames[s.setId] ?? s.setId}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        {/* Step 4: Role */}
        <Section
          step={4}
          title="Role"
          required
          done={!!roleId}
          summary={roles.find((r) => r.cardId === roleId)?.name}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
            <RoleColumn
              heading="Keepers & Seekers"
              roles={rolesGrouped.keeperSeeker}
              selectedId={roleId}
              onSelect={setRoleId}
              disabled={submitting || readOnly}
            />
            <RoleColumn
              heading="Support roles"
              roles={rolesGrouped.supports}
              selectedId={roleId}
              onSelect={setRoleId}
              disabled={submitting || readOnly}
              demphasize={(r) => isSupportOfOwnClan(r.name, clan)}
            />
          </div>
          {roleId && isSupportOfOwnClan(roles.find((r) => r.cardId === roleId)?.name ?? '', clan) && (
            <p style={{ opacity: 0.7, fontSize: '0.8rem', marginTop: '0.6rem' }}>
              Heads up — Support of the {clan} on a {clan} deck is unusual.
              Most players pick this role when splashing into a clan they don&apos;t already play.
            </p>
          )}
        </Section>

        {/* Step 5: Splash clan (optional) */}
        <Section
          step={5}
          title="Splash clan"
          summary={
            forcedSplashClan
              ? `${forcedSplashClan} (locked by role)`
              : splashClan === null
                ? 'None (mono-clan)'
                : splashClan
                  ? `${splashClan}`
                  : 'Decide later'
          }
        >
          {!clan ? (
            <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>
              Pick a clan first.
            </p>
          ) : forcedSplashClan ? (
            <p style={{ opacity: 0.7, fontSize: '0.85rem', margin: 0 }}>
              Your role <strong>{selectedRole?.name}</strong> locks your splash to{' '}
              <strong>{forcedSplashClan}</strong>.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {/* "Decide later" — default; gets auto-set on first out-of-clan add */}
                <button
                  type="button"
                  onClick={() => setSplashClan(undefined)}
                  disabled={submitting || readOnly}
                  style={chipButtonStyle(splashClan === undefined)}
                  title="Leave unset; the editor will set this when you add the first off-clan card."
                >
                  Decide later
                </button>
                {/* Explicit mono-clan */}
                <button
                  type="button"
                  onClick={() => setSplashClan(null)}
                  disabled={submitting || readOnly}
                  style={chipButtonStyle(splashClan === null)}
                  title="No splash — only your primary clan + Neutral cards."
                >
                  None (mono-clan)
                </button>
                {CLANS.filter((c) => c !== clan).map((c) => {
                  const active = splashClan === c
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSplashClan(c)}
                      disabled={submitting || readOnly}
                      style={{
                        ...chipButtonStyle(active),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        background: active ? CLAN_ACCENT[c].color : 'var(--theme-surface-2)',
                        color: active ? '#fff' : 'var(--theme-text)',
                        borderColor: active ? CLAN_ACCENT[c].color : 'var(--theme-border)',
                      }}
                    >
                      <ClanBubble clan={c} inverted={active} />
                      {c}
                    </button>
                  )
                })}
              </div>
              <p style={{ opacity: 0.6, fontSize: '0.78rem', marginTop: '0.55rem', margin: 0 }}>
                You may only ever have one splash clan. If you skip this, the
                editor will lock it in the first time you add an out-of-clan
                card to your conflict deck.
              </p>
            </>
          )}
        </Section>

        {/* Notes (optional) */}
        <Section
          step={0}
          title="Notes (optional)"
          summary={notes.trim() ? `${notes.trim().split(/\s+/).length} words` : undefined}
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Plan, matchups, write-up…"
            disabled={submitting || readOnly}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ marginTop: '0.45rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', opacity: 0.85 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <input
                type="radio"
                checked={origin === 'own'}
                onChange={() => setOrigin('own')}
                disabled={submitting || readOnly}
              /> My own build
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <input
                type="radio"
                checked={origin === 'imported'}
                onChange={() => setOrigin('imported')}
                disabled={submitting || readOnly}
              /> Imported
            </label>
            {origin === 'imported' && (
              <input
                type="text"
                value={importedFrom}
                onChange={(e) => setImportedFrom(e.target.value)}
                placeholder="URL or description"
                disabled={submitting || readOnly}
                style={{ ...inputStyle, flex: 1, minWidth: '14rem' }}
              />
            )}
          </div>
        </Section>

        {error && (
          <p style={{ color: '#e8755a' }}>Error: {error}</p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              background: canSubmit ? 'var(--theme-primary)' : 'var(--theme-surface)',
              color: canSubmit ? 'var(--theme-background)' : 'var(--theme-text-muted)',
              border: canSubmit ? 'none' : '1px solid var(--theme-border)',
              padding: '0.55rem 1.1rem',
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Creating…' : 'Create deck'}
          </button>
          <Link to={`/games/${gameId}/decks/`}>Cancel</Link>
          <span style={{ flex: 1 }} />
          {!canSubmit && !submitting && (
            <span style={{ opacity: 0.6, fontSize: '0.82rem' }}>
              Pick {[
                !formatId && 'format',
                !clan && 'clan',
                !strongholdId && 'stronghold',
                !roleId && 'role',
              ].filter(Boolean).join(', ')} to continue.
            </span>
          )}
        </div>
      </form>
    </>
  )
}

// =============================================================================
// Section helper — gives every block the same anatomy: numbered badge, title,
// summary chip in the corner when complete, content below.
// =============================================================================

interface SectionProps {
  step: number
  title: string
  summary?: React.ReactNode
  required?: boolean
  done?: boolean
  children: React.ReactNode
}

function Section({ step, title, summary, required, done, children }: SectionProps): React.ReactElement {
  return (
    <section
      style={{
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        borderLeft: done ? '4px solid #3fa86b' : required ? '4px solid var(--theme-primary)' : '4px solid transparent',
        borderRadius: 6,
        padding: '0.75rem 0.9rem',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.5rem' }}>
        {step > 0 && (
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: done ? '#3fa86b' : 'var(--theme-surface-2)',
              color: done ? '#fff' : 'var(--theme-text-muted)',
              border: '1px solid var(--theme-border)',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            {done ? '✓' : step}
          </span>
        )}
        <h2 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 600 }}>
          {title}
          {required && <span style={{ color: '#e8755a', marginLeft: '0.25rem' }} aria-label="required">*</span>}
        </h2>
        {summary && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.78rem',
              opacity: 0.85,
              background: 'var(--theme-background)',
              border: '1px solid var(--theme-border)',
              borderRadius: 999,
              padding: '0.12rem 0.55rem',
            }}
          >
            {summary}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}

// =============================================================================
// Clan bubble (clan glyph rendered to a small chip)
// =============================================================================

function ClanBubble({ clan, inverted }: { clan: Clan; inverted?: boolean }): React.ReactElement {
  const { abbr, color } = CLAN_ACCENT[clan]
  return (
    <span
      aria-hidden
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: inverted ? 'rgba(255,255,255,0.18)' : color,
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.65rem',
        letterSpacing: '0.02em',
      }}
    >
      {abbr}
    </span>
  )
}

// =============================================================================
// Role column (radio list with optional de-emphasis)
// =============================================================================

interface RoleColumnProps {
  heading: string
  roles: RoleNode[]
  selectedId: string
  onSelect: (cardId: string) => void
  disabled?: boolean
  demphasize?: (role: RoleNode) => boolean
}

function RoleColumn({ heading, roles, selectedId, onSelect, disabled, demphasize }: RoleColumnProps): React.ReactElement {
  return (
    <div>
      <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.65, marginBottom: '0.4rem' }}>
        {heading}
      </h3>
      <ul style={{ listStyle: 'none', display: 'grid', gap: '0.25rem' }}>
        {roles.map((r) => {
          const active = selectedId === r.cardId
          const dim = demphasize?.(r) ?? false
          return (
            <li key={r.cardId}>
              <button
                type="button"
                onClick={() => onSelect(r.cardId)}
                disabled={disabled}
                style={{
                  ...radioRowStyle(active),
                  opacity: dim && !active ? 0.45 : undefined,
                }}
              >
                <span style={radioDotStyle(active)} />
                <span>{r.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function isSupportOfOwnClan(roleName: string, clan: string): boolean {
  if (!clan) return false
  return new RegExp(`^Support of the ${clan}$`, 'i').test(roleName)
}

// =============================================================================
// Styles
// =============================================================================

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.65rem',
  background: 'var(--theme-background)',
  color: 'var(--theme-text)',
  border: '1px solid var(--theme-border)',
  borderRadius: 6,
  font: 'inherit',
}

function chipButtonStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--theme-primary)' : 'var(--theme-surface-2)',
    color: active ? 'var(--theme-background)' : 'var(--theme-text)',
    border: `1px solid ${active ? 'var(--theme-primary)' : 'var(--theme-border)'}`,
    borderRadius: 999,
    padding: '0.35rem 0.8rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
  }
}

function radioRowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    textAlign: 'left',
    padding: '0.4rem 0.55rem',
    background: active ? 'rgba(108, 122, 138, 0.18)' : 'transparent',
    border: `1px solid ${active ? 'var(--theme-primary)' : 'transparent'}`,
    borderRadius: 5,
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '0.88rem',
  }
}

function radioDotStyle(active: boolean): React.CSSProperties {
  return {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: `2px solid ${active ? 'var(--theme-primary)' : 'var(--theme-border)'}`,
    background: active ? 'var(--theme-primary)' : 'transparent',
    flexShrink: 0,
  }
}

// =============================================================================
// GraphQL + Head
// =============================================================================

export const Head: HeadFC<Data, PageContext> = ({ pageContext }) => {
  const game = getGame(pageContext.gameId)
  return <title>{game ? `New deck · ${game.shortName ?? game.name} · tcgdb` : 'New deck · tcgdb'}</title>
}

export const query = graphql`
  query DeckCreate($gameId: String!) {
    allStrongholds: allCard(
      filter: { gameId: { eq: $gameId }, type: { eq: "Stronghold" } }
      sort: { name: ASC }
    ) {
      nodes {
        cardId
        name
        clan
        setId
        publisherId
      }
    }
    allRoles: allCard(
      filter: { gameId: { eq: $gameId }, type: { eq: "Role" } }
      sort: { name: ASC }
    ) {
      nodes {
        cardId
        name
        clan
        setId
        publisherId
        roleClassifier
        roleRing
        roleClan
        forcesSplashClan
        influenceBonus
      }
    }
    allCardSet(filter: { gameId: { eq: $gameId } }) {
      nodes {
        setId
        name
      }
    }
  }
`
