import * as React from 'react'
import { graphql, Link, type HeadFC, type PageProps } from 'gatsby'
import { GAMES } from '../data/games'
import { useSidecarState } from '../state/SidecarStateProvider'
import {
  runAllChecks,
  type CheckGroup,
  type CheckResult,
  type CheckStatus,
} from '../lib/system-checks'
import type { Card, MutableState } from '../types/data'

// =============================================================================
// GraphQL — landing page snapshots the L5R card set at build time so the rules
// checks have something to chew on. (Single game for now; expand if/when
// other games gain card data.)
// =============================================================================

interface CardNode {
  cardId: string
  gameId: string
  setId: string
  publisherId: string
  name: string
  type: string
  unique: boolean | null
  text: string | null
  clan: string | null
  deck: string | null
  faction: string | null
  cost: number | null
  military: number | null
  political: number | null
  glory: number | null
  strength: number | null
  influence: number | null
  influencePool: number | null
  element: string | null
  honor: number | null
  fate: number | null
  traits: string[] | null
  flipSideOf: string | null
  unverified: boolean | null
}

interface SetNode {
  setId: string
  name: string
}

interface Data {
  allCard: { nodes: CardNode[] }
  allCardSet: { nodes: SetNode[] }
}

// Adapt the page-query nodes (where everything is nullable) into the Card
// shape system-checks expects.
function adaptCards(nodes: CardNode[]): Card[] {
  return nodes.map((n) => {
    const c: Card = {
      id: n.cardId,
      gameId: n.gameId,
      setId: n.setId,
      publisherId: n.publisherId,
      name: n.name,
      type: n.type,
      ...(n.unique != null ? { unique: n.unique } : {}),
      ...(n.text != null ? { text: n.text } : {}),
      ...(n.unverified != null ? { unverified: n.unverified } : {}),
      ...(n.flipSideOf != null ? { flipSideOf: n.flipSideOf } : {}),
    }
    // Carry the L5R-specific fields under their normal names — these are
    // index-signature fields on Card so this is type-safe.
    if (n.clan != null) (c as Record<string, unknown>).clan = n.clan
    if (n.deck != null) (c as Record<string, unknown>).deck = n.deck
    if (n.faction != null) (c as Record<string, unknown>).faction = n.faction
    if (n.cost != null) (c as Record<string, unknown>).cost = n.cost
    if (n.military != null) (c as Record<string, unknown>).military = n.military
    if (n.political != null) (c as Record<string, unknown>).political = n.political
    if (n.glory != null) (c as Record<string, unknown>).glory = n.glory
    if (n.strength != null) (c as Record<string, unknown>).strength = n.strength
    if (n.influence != null) (c as Record<string, unknown>).influence = n.influence
    if (n.influencePool != null) (c as Record<string, unknown>).influencePool = n.influencePool
    if (n.element != null) (c as Record<string, unknown>).element = n.element
    if (n.honor != null) (c as Record<string, unknown>).honor = n.honor
    if (n.fate != null) (c as Record<string, unknown>).fate = n.fate
    if (n.traits != null) (c as Record<string, unknown>).traits = n.traits
    return c
  })
}

// =============================================================================
// Page
// =============================================================================

export default function HomePage(props: PageProps<Data>): React.ReactElement {
  const cards = React.useMemo(() => adaptCards(props.data.allCard.nodes), [props.data])
  const sets = props.data.allCardSet.nodes

  // Sidecar reachability — refresh on demand via setProbeKey.
  const [sidecarHealth, setSidecarHealth] = React.useState<{ ok: boolean; error?: string } | null>(null)
  const [probeKey, setProbeKey] = React.useState(0)
  const { state: sidecarState } = useSidecarState()

  React.useEffect(() => {
    let cancelled = false
    setSidecarHealth(null)
    fetch('http://localhost:8001/api/health')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(() => { if (!cancelled) setSidecarHealth({ ok: true }) })
      .catch((err: unknown) => {
        if (cancelled) return
        setSidecarHealth({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    return () => { cancelled = true }
  }, [probeKey])

  const groups: CheckGroup[] = React.useMemo(() => runAllChecks({
    cards,
    sets,
    sidecarState: sidecarState as MutableState | null,
    sidecarHealth,
    gameId: 'l5r-lcg',
  }), [cards, sets, sidecarState, sidecarHealth])

  return (
    <>
      <header style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0 }}>tcgdb</h1>
        <p style={{ opacity: 0.75, margin: '0.35rem 0 0' }}>
          System status &amp; feature health for this build.
          {' '}
          <span style={{ opacity: 0.6 }}>
            (Green ✓ means the framework, feature, or rule is verified at page-load time.
            Red ✗ flags a regression.)
          </span>
        </p>
      </header>

      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <OverallPill groups={groups} />
        <button
          type="button"
          onClick={() => setProbeKey((n) => n + 1)}
          style={{
            background: 'var(--theme-surface-2)',
            color: 'var(--theme-text)',
            border: '1px solid var(--theme-border)',
            borderRadius: 6,
            padding: '0.35rem 0.7rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Re-probe sidecar
        </button>
      </div>

      {groups.map((g) => <CheckGroupCard key={g.id} group={g} />)}

      <section style={{ marginTop: '1.75rem' }}>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.05rem' }}>Jump to a game</h2>
        <ul
          style={{
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '0.65rem',
          }}
        >
          {GAMES.map((g) => (
            <li key={g.id}>
              <Link
                to={`/games/${g.id}/`}
                style={{
                  display: 'block',
                  padding: '0.7rem 0.85rem',
                  background: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  borderLeft: `4px solid ${g.theme.primary}`,
                  borderRadius: 6,
                  color: 'var(--theme-text)',
                  textDecoration: 'none',
                }}
              >
                <div style={{ fontWeight: 600 }}>{g.name}</div>
                {g.shortName && (
                  <div style={{ opacity: 0.55, fontSize: '0.8rem' }}>{g.shortName}</div>
                )}
                <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', opacity: 0.65 }}>
                  status: {g.status}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

// =============================================================================
// Overall pill — quick "is everything green?" summary
// =============================================================================

function OverallPill({ groups }: { groups: CheckGroup[] }): React.ReactElement {
  const counts = countByStatus(groups.flatMap((g) => g.results))
  const overall: CheckStatus = counts.fail > 0
    ? 'fail'
    : counts.warn > 0
      ? 'warn'
      : counts.pending > 0
        ? 'pending'
        : 'pass'
  const palette = STATUS_PALETTE[overall]
  const label = overall === 'pass' ? 'All green' :
                overall === 'warn' ? 'Warnings present' :
                overall === 'pending' ? 'Probing…' : 'Failures present'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.55rem',
        padding: '0.32rem 0.75rem',
        background: palette.fillSoft,
        border: `1px solid ${palette.border}`,
        borderRadius: 999,
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      <StatusGlyph status={overall} />
      {label}
      <span style={{ opacity: 0.75, fontWeight: 400, fontSize: '0.78rem' }}>
        ({counts.pass} ✓, {counts.warn} ◦, {counts.fail} ✗{counts.skip ? `, ${counts.skip} skipped` : ''})
      </span>
    </span>
  )
}

// =============================================================================
// Group card
// =============================================================================

function CheckGroupCard({ group }: { group: CheckGroup }): React.ReactElement {
  const counts = countByStatus(group.results)
  const groupStatus: CheckStatus = counts.fail > 0
    ? 'fail'
    : counts.warn > 0
      ? 'warn'
      : counts.pending > 0
        ? 'pending'
        : 'pass'
  const palette = STATUS_PALETTE[groupStatus]

  return (
    <section
      style={{
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        borderLeft: `4px solid ${palette.accent}`,
        borderRadius: 8,
        padding: '0.85rem 1rem',
        marginBottom: '0.85rem',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>{group.title}</h2>
        <span style={{
          fontSize: '0.75rem',
          opacity: 0.85,
          color: palette.accent,
          fontWeight: 600,
        }}>
          {counts.pass}/{group.results.length} pass
          {counts.fail ? ` · ${counts.fail} fail` : ''}
          {counts.warn ? ` · ${counts.warn} warn` : ''}
          {counts.pending ? ` · ${counts.pending} pending` : ''}
          {counts.skip ? ` · ${counts.skip} skipped` : ''}
        </span>
      </header>
      {group.description && (
        <p style={{ opacity: 0.7, fontSize: '0.82rem', margin: '0 0 0.55rem' }}>
          {group.description}
        </p>
      )}
      <ul style={{ listStyle: 'none', display: 'grid', gap: '0.15rem' }}>
        {group.results.map((r) => <CheckResultRow key={r.id} result={r} />)}
      </ul>
    </section>
  )
}

function CheckResultRow({ result }: { result: CheckResult }): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const palette = STATUS_PALETTE[result.status]
  const hasDetails = (result.details?.length ?? 0) > 0
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '0.55rem',
        alignItems: 'baseline',
        padding: '0.32rem 0.4rem',
        borderRadius: 4,
        background: result.status === 'fail' ? palette.fillSoft : 'transparent',
      }}
    >
      <StatusGlyph status={result.status} />
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.5rem', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{result.title}</span>
        {result.message && (
          <span style={{ opacity: 0.75, fontSize: '0.82rem' }}>{result.message}</span>
        )}
        {open && hasDetails && (
          <ul style={{ flexBasis: '100%', margin: '0.35rem 0 0', listStyle: 'none', padding: 0 }}>
            {result.details?.map((d, i) => (
              <li
                key={i}
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '0.76rem',
                  opacity: 0.85,
                  padding: '0.12rem 0.5rem',
                  background: 'var(--theme-background)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: 3,
                  margin: '0.12rem 0',
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                }}
              >
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hasDetails && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--theme-text-muted)',
            fontSize: '0.78rem',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {open ? 'hide' : `${result.details!.length} details`}
        </button>
      )}
    </li>
  )
}

// =============================================================================
// Status glyph + palette
// =============================================================================

function StatusGlyph({ status }: { status: CheckStatus }): React.ReactElement {
  const palette = STATUS_PALETTE[status]
  return (
    <span
      aria-label={status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: palette.accent,
        color: '#fff',
        fontSize: '0.7rem',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {palette.glyph}
    </span>
  )
}

const STATUS_PALETTE: Record<CheckStatus, { accent: string; border: string; fillSoft: string; glyph: string }> = {
  pass:    { accent: '#3fa86b', border: 'rgba(63, 168, 107, 0.45)',  fillSoft: 'rgba(63, 168, 107, 0.10)',  glyph: '✓' },
  fail:    { accent: '#c0392b', border: 'rgba(192, 57, 43, 0.5)',    fillSoft: 'rgba(192, 57, 43, 0.12)',    glyph: '✗' },
  warn:    { accent: '#d4972e', border: 'rgba(212, 151, 46, 0.5)',   fillSoft: 'rgba(212, 151, 46, 0.12)',   glyph: '!' },
  pending: { accent: '#6c7a8a', border: 'rgba(108, 122, 138, 0.5)',  fillSoft: 'rgba(108, 122, 138, 0.15)', glyph: '…' },
  skip:    { accent: '#4a5462', border: 'rgba(74, 84, 98, 0.5)',     fillSoft: 'rgba(74, 84, 98, 0.10)',    glyph: '–' },
}

function countByStatus(results: CheckResult[]): Record<CheckStatus, number> {
  const out: Record<CheckStatus, number> = { pass: 0, fail: 0, warn: 0, pending: 0, skip: 0 }
  for (const r of results) out[r.status]++
  return out
}

// =============================================================================
// Head + GraphQL
// =============================================================================

export const Head: HeadFC = () => <title>tcgdb · status</title>

export const query = graphql`
  query LandingDashboard {
    allCard(filter: { gameId: { eq: "l5r-lcg" } }) {
      nodes {
        cardId
        gameId
        setId
        publisherId
        name
        type
        unique
        text
        clan
        deck
        faction
        cost
        military
        political
        glory
        strength
        influence
        influencePool
        element
        honor
        fate
        traits
        flipSideOf
        unverified
      }
    }
    allCardSet(filter: { gameId: { eq: "l5r-lcg" } }) {
      nodes {
        setId
        name
      }
    }
  }
`
