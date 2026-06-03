import * as React from 'react'
import { Link, type HeadFC } from 'gatsby'

export default function SettingsHome(): React.ReactElement {
  return (
    <>
      <h1>Settings</h1>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Cross-cutting controls and inspection. Per-game options live on the
        game home page.
      </p>

      <ul style={{ listStyle: 'none', display: 'grid', gap: '0.75rem' }}>
        <li>
          <Link
            to="/settings/audit/"
            style={{
              display: 'block',
              padding: '0.85rem 1rem',
              background: 'var(--theme-surface)',
              border: '1px solid var(--theme-border)',
              borderLeft: '4px solid var(--theme-primary)',
              borderRadius: 8,
              color: 'var(--theme-text)',
            }}
          >
            <div style={{ fontWeight: 600 }}>Audit →</div>
            <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>
              Things flagged for review — unverified collection entries,
              stubbed game modules, preview sets, homebrew sources.
            </div>
          </Link>
        </li>
      </ul>
    </>
  )
}

export const Head: HeadFC = () => <title>Settings · tcgdb</title>
