import * as React from 'react'
import { graphql, Link, type HeadFC, type PageProps } from 'gatsby'
import { CardLink } from '../components/CardLink'
import { getGame } from '../data/games'
import CardFilterPanel, {
  DEFAULT_FILTERS,
  isEmptyFilters,
  matchesFilters,
  type FilterState,
} from '../components/CardFilterPanel'

interface PageContext {
  gameId: string
}

interface CardNode {
  cardId: string
  setId: string
  name: string
  nameAscii: string | null
  type: string
  unique: boolean | null
  text: string | null
  clan: string | null
  deck: string | null
  faction: string | null
  cost: number | null
  military: string | null
  political: string | null
  militaryBonus: string | null
  politicalBonus: string | null
  glory: number | null
  strength: number | null
  influence: number | null
  element: string | null
  elements: string[] | null
  traits: string[] | null
  traitsAscii: string[] | null
}

interface SetNode {
  setId: string
  name: string
  cycle: string | null
  parentSetId: string | null
  type: string
}

interface Data {
  allCard: { nodes: CardNode[] }
  allCardSet: { nodes: SetNode[] }
}

type ViewMode = 'table' | 'grouped'
const PAGE_SIZE = 50

export default function CardsIndexPage(
  props: PageProps<Data, PageContext>
): React.ReactElement {
  const { gameId } = props.pageContext
  const game = getGame(gameId)
  const allCards = props.data.allCard.nodes
  const sets = props.data.allCardSet.nodes
  const setLookup = React.useMemo(
    () => Object.fromEntries(sets.map((s) => [s.setId, s] as const)),
    [sets]
  )
  const allTraits = React.useMemo(() => {
    const s = new Set<string>()
    for (const c of allCards) for (const t of c.traits ?? []) s.add(t)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [allCards])

  const [filters, setFilters] = React.useState<FilterState>(DEFAULT_FILTERS)
  const [panelOpen, setPanelOpen] = React.useState(true)
  const [view, setView] = React.useState<ViewMode>('table')
  const [page, setPage] = React.useState(0)

  React.useEffect(() => { setPage(0) }, [filters])

  const filtered = React.useMemo(
    () => allCards.filter((c) => matchesFilters(c, filters)),
    [allCards, filters]
  )

  return (
    <>
      <header style={{ marginBottom: '1rem' }}>
        <Link to={`/games/${gameId}/`} style={{ opacity: 0.7 }}>
          ← {game?.shortName ?? game?.name ?? gameId}
        </Link>
        <h1 style={{ marginTop: '0.5rem' }}>Cards</h1>
        <p style={{ opacity: 0.7 }}>
          {allCards.length.toLocaleString()} card{allCards.length === 1 ? '' : 's'} across{' '}
          {sets.length} set{sets.length === 1 ? '' : 's'}.
          {!isEmptyFilters(filters) && (
            <> <strong>{filtered.length.toLocaleString()}</strong> match current filters.</>
          )}
        </p>
      </header>

      <CardFilterPanel
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        traits={allTraits}
        filters={filters}
        onChange={setFilters}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          margin: '1.25rem 0 0.75rem',
        }}
      >
        <ViewToggle view={view} onChange={setView} />
        <span style={{ flex: 1 }} />
        <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>
          {filtered.length.toLocaleString()} result{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p style={{ opacity: 0.7, padding: '2rem 0' }}>No cards match the current filters.</p>
      ) : view === 'table' ? (
        <ResultsTable
          gameId={gameId}
          cards={filtered}
          page={page}
          onPageChange={setPage}
        />
      ) : (
        <GroupedView gameId={gameId} cards={filtered} setLookup={setLookup} />
      )}
    </>
  )
}

// =============================================================================
// View toggle / results
// =============================================================================

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }): React.ReactElement {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--theme-border)', borderRadius: 6, overflow: 'hidden' }}>
      {(['table', 'grouped'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            background: v === view ? 'var(--theme-primary)' : 'var(--theme-surface-2)',
            color: v === view ? 'var(--theme-background)' : 'var(--theme-text)',
            border: 'none',
            padding: '0.4rem 0.85rem',
            fontSize: '0.82rem',
            textTransform: 'capitalize',
            cursor: 'pointer',
          }}
        >
          {v === 'table' ? 'Table view' : 'Grouped view'}
        </button>
      ))}
    </div>
  )
}

function ResultsTable({
  gameId, cards, page, onPageChange,
}: { gameId: string; cards: CardNode[]; page: number; onPageChange: (n: number) => void }): React.ReactElement {
  const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE))
  const clampedPage = Math.min(page, pages - 1)
  const slice = cards.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE)

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--theme-border)', textAlign: 'left' }}>
              <Th>Name</Th>
              <Th>Traits</Th>
              <Th>Type</Th>
              <Th>Faction</Th>
              <Th>Deck</Th>
              <Th align="right">Cost</Th>
              <Th align="right">Mil</Th>
              <Th align="right">Pol</Th>
              <Th align="right">Glory</Th>
              <Th align="right">Str</Th>
            </tr>
          </thead>
          <tbody>
            {slice.map((c) => (
              <tr key={c.cardId} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                <Td>
                  <CardLink gameId={gameId} cardId={c.cardId} name={c.name} />
                  {c.unique && (
                    <span title="Unique" style={{ marginLeft: '0.35rem', opacity: 0.55, fontSize: '0.7rem' }}>◆</span>
                  )}
                </Td>
                <Td muted small>
                  {c.traits?.length ? (
                    <em style={{ fontStyle: 'italic' }}>{c.traits.join('. ')}.</em>
                  ) : '—'}
                </Td>
                <Td>{c.type}</Td>
                <Td muted>{c.clan ?? c.faction ?? '—'}</Td>
                <Td muted>{c.deck ?? '—'}</Td>
                <Td align="right" muted>{c.cost ?? '—'}</Td>
                <Td align="right" muted>{c.military ?? c.militaryBonus ?? '—'}</Td>
                <Td align="right" muted>{c.political ?? c.politicalBonus ?? '—'}</Td>
                <Td align="right" muted>{c.glory ?? '—'}</Td>
                <Td align="right" muted>{c.strength ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={clampedPage}
        pages={pages}
        totalRows={cards.length}
        pageSize={PAGE_SIZE}
        onPageChange={onPageChange}
      />
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }): React.ReactElement {
  return (
    <th
      style={{
        padding: '0.45rem 0.6rem',
        fontWeight: 600,
        fontSize: '0.78rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        opacity: 0.65,
        textAlign: align ?? 'left',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children, align, muted, small,
}: { children: React.ReactNode; align?: 'left' | 'right'; muted?: boolean; small?: boolean }): React.ReactElement {
  return (
    <td
      style={{
        padding: '0.45rem 0.6rem',
        textAlign: align ?? 'left',
        opacity: muted ? 0.85 : 1,
        fontSize: small ? '0.8rem' : '0.88rem',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  )
}

function Pagination({
  page, pages, totalRows, pageSize, onPageChange,
}: { page: number; pages: number; totalRows: number; pageSize: number; onPageChange: (n: number) => void }): React.ReactElement {
  const first = page * pageSize + 1
  const last = Math.min(totalRows, (page + 1) * pageSize)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        padding: '0.6rem 0',
        fontSize: '0.82rem',
      }}
    >
      <span style={{ opacity: 0.7 }}>
        {first.toLocaleString()}–{last.toLocaleString()} of {totalRows.toLocaleString()}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        style={{ padding: '0.25rem 0.55rem', fontSize: '0.82rem', opacity: page === 0 ? 0.4 : 1 }}
      >
        ‹ Prev
      </button>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pages - 1, page + 1))}
        disabled={page >= pages - 1}
        style={{ padding: '0.25rem 0.55rem', fontSize: '0.82rem', opacity: page >= pages - 1 ? 0.4 : 1 }}
      >
        Next ›
      </button>
    </div>
  )
}

function GroupedView({
  gameId, cards, setLookup,
}: { gameId: string; cards: CardNode[]; setLookup: Record<string, SetNode> }): React.ReactElement {
  const grouped = React.useMemo(() => {
    const bySet = new Map<string, CardNode[]>()
    for (const c of cards) {
      const list = bySet.get(c.setId) ?? []
      list.push(c)
      bySet.set(c.setId, list)
    }
    return Array.from(bySet.entries()).sort(([a], [b]) => {
      const an = setLookup[a]?.name ?? a
      const bn = setLookup[b]?.name ?? b
      return an.localeCompare(bn)
    })
  }, [cards, setLookup])
  return (
    <div>
      {grouped.map(([setId, list]) => {
        const set = setLookup[setId]
        return (
          <section key={setId} style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: '0.4rem' }}>
              <Link to={`/games/${gameId}/sets/${setId}/`}>{set?.name ?? setId}</Link>{' '}
              <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.85rem' }}>
                ({list.length})
              </span>
            </h2>
            <ul style={{ listStyle: 'none' }}>
              {list.map((c) => (
                <li
                  key={c.cardId}
                  style={{
                    padding: '0.25rem 0',
                    borderBottom: '1px solid var(--theme-border)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: '0.75rem',
                    alignItems: 'baseline',
                  }}
                >
                  <CardLink gameId={gameId} cardId={c.cardId} name={c.name} />
                  <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{c.type}</span>
                  <span style={{ opacity: 0.6, fontSize: '0.8rem', minWidth: '5rem', textAlign: 'right' }}>
                    {c.clan ?? c.faction ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// =============================================================================
// GraphQL page query + Head
// =============================================================================

export const Head: HeadFC<Data, PageContext> = ({ pageContext }) => {
  const game = getGame(pageContext.gameId)
  return <title>{game ? `Cards · ${game.shortName ?? game.name} · tcgdb` : 'Cards · tcgdb'}</title>
}

export const query = graphql`
  query CardsIndex($gameId: String!) {
    allCard(filter: { gameId: { eq: $gameId } }, sort: { name: ASC }) {
      nodes {
        cardId
        setId
        name
        nameAscii
        type
        unique
        text
        clan
        deck
        faction
        cost
        military
        political
        militaryBonus
        politicalBonus
        glory
        strength
        influence
        element
        elements
        traits
        traitsAscii
      }
    }
    allCardSet(filter: { gameId: { eq: $gameId } }) {
      nodes {
        setId
        name
        cycle
        parentSetId
        type
      }
    }
  }
`
