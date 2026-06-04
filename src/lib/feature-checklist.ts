// Hand-curated manifest of user-facing features that have been shipped.
// Drives the "Implementation checklist" group on the landing-page dashboard.
//
// Statuses:
//   shipped — fully built, tracked by a live verify() function so regressions
//             in the underlying component show up red on the dashboard.
//   partial — shipped but missing a known piece (e.g. statistics tab content
//             waits on numeric data). Renders as warn.
//   planned — explicitly known to be unimplemented. Renders as skip.
//
// Adding a feature is one line. The verify() callback runs in the browser at
// dashboard-render time; keep it cheap.

import {
  hasTrigger, getRoleRestriction, hasKeyword,
  isEmptyFilters, DEFAULT_FILTERS,
} from '../components/CardFilterPanel'

export type FeatureStatus = 'shipped' | 'partial' | 'planned'

export interface FeatureChecklistItem {
  id: string
  title: string
  status: FeatureStatus
  notes?: string
  /** Optional live regression check. Throws ⇒ fail. */
  verify?: () => { ok: boolean; message?: string; details?: string[] }
}

export const FEATURE_CHECKLIST: FeatureChecklistItem[] = [
  // --- Foundations --------------------------------------------------------
  {
    id: 'card-data-pipeline',
    title: 'Card data pipeline',
    status: 'shipped',
    notes: 'Wiki-paste parser + replace policy. 1,413 L5R cards across 41 sets.',
  },
  {
    id: 'sidecar-crud',
    title: 'Sidecar mutation API',
    status: 'shipped',
    notes: 'Express service on :8001. Atomic writes, CORS-locked to localhost.',
  },
  {
    id: 'built-deck-invariant',
    title: 'Built-deck invariant',
    status: 'shipped',
    notes: 'Cannot mark a deck built if its cards over-claim against collection.',
  },

  // --- Card browser -------------------------------------------------------
  {
    id: 'cards-browser',
    title: 'Cards browser (filter panel + table)',
    status: 'shipped',
    verify: () => {
      // Confirm the shared parsers are still exported and behaving.
      if (!hasTrigger('Action: x', 'Action')) return { ok: false, message: 'hasTrigger import is stale' }
      if (hasTrigger('Forced Reaction: x', 'Reaction')) return { ok: false, message: 'Reaction false-positive guard broke' }
      if (getRoleRestriction('Earth role only.') !== 'earth') return { ok: false, message: 'getRoleRestriction broke' }
      if (!hasKeyword('Pride. x', 'Pride')) return { ok: false, message: 'hasKeyword broke' }
      if (!isEmptyFilters(DEFAULT_FILTERS)) return { ok: false, message: 'isEmptyFilters(DEFAULT_FILTERS) should be true' }
      return { ok: true, message: 'Filter panel exports + parsers healthy.' }
    },
  },
  {
    id: 'card-detail-errata',
    title: 'Card detail with errata + rulings',
    status: 'shipped',
  },

  // --- Collection ---------------------------------------------------------
  {
    id: 'collection-page',
    title: 'Collection page',
    status: 'shipped',
  },
  {
    id: 'unverified-audit',
    title: 'Audit page (unverified flags)',
    status: 'shipped',
    notes: 'Settings → Audit surfaces every collection + card record flagged unverified.',
  },

  // --- Decks --------------------------------------------------------------
  {
    id: 'decks-list',
    title: 'Decks list with availability indicators',
    status: 'shipped',
  },
  {
    id: 'deck-create-wizard',
    title: 'Deck-create wizard (Format → Clan → Stronghold → Role)',
    status: 'shipped',
  },
  {
    id: 'deck-editor-two-col',
    title: 'Deck editor (two-column layout + embedded filter panel)',
    status: 'shipped',
    notes: 'Sidebar with type-breakdown counts + qty steppers; right-side card picker reuses CardFilterPanel.',
  },
  {
    id: 'deck-statistics-tab',
    title: 'Deck editor: Statistics tab content',
    status: 'partial',
    notes: 'Tab renders but is a placeholder until numeric stat data lands.',
  },

  // --- Data passes still pending -----------------------------------------
  {
    id: 'numeric-stat-pass',
    title: 'Numeric stat pass (cost / military / political / glory / strength / influence)',
    status: 'planned',
    notes: '0/1413 cards currently populated. Unlocks numeric filters + cost columns + stronghold influence pool.',
  },
  {
    id: 'card-images',
    title: 'Card image assets',
    status: 'planned',
    notes: 'Card detail / picker / wizard would all gain image previews.',
  },

  // --- Jigoku integration -------------------------------------------------
  {
    id: 'jigoku-import',
    title: 'Import deck from Jigoku',
    status: 'planned',
    notes: 'Needs a sample Jigoku export to design the parser.',
  },
  {
    id: 'jigokulink-export',
    title: 'Export deck to JigokuLink',
    status: 'planned',
  },
]
