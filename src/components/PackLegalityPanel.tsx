import React, { useMemo, useState } from 'react'
import type { PackLegalityGroup } from '../games/l5r-lcg/packMeta'

export interface PackLegalityPanelProps {
  /** Ordered, grouped packs (Core → Premium → cycles → Clan Packs → Other). */
  groups: PackLegalityGroup[]
  /** Every selectable set id across all groups. */
  allSetIds: string[]
  /** Currently-allowed set ids; `undefined` = all packs allowed (no filter). */
  allowedPacks: string[] | undefined
  /**
   * Emit the next legality state:
   *   - `null`  → clear the filter (all packs allowed)
   *   - `string[]` → exactly these sets are legal ([] = none)
   * Callers normalise "all selected" to `null` for us; we emit `null` when a
   * change results in every pack being selected.
   */
  onChange: (next: string[] | null) => void
  disabled?: boolean
}

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  color: '#2563eb',
  cursor: 'pointer',
  font: 'inherit',
  textDecoration: 'underline',
}

export default function PackLegalityPanel(props: PackLegalityPanelProps): React.ReactElement {
  const { groups, allSetIds, allowedPacks, onChange, disabled } = props
  const [open, setOpen] = useState(false)

  const allowAll = allowedPacks === undefined
  const selected = useMemo(
    () => (allowAll ? new Set(allSetIds) : new Set(allowedPacks)),
    [allowAll, allowedPacks, allSetIds],
  )

  const selectedCount = allowAll ? allSetIds.length : selected.size
  const total = allSetIds.length

  /** Normalise + emit a new selection set. Full selection → null (all). */
  function emit(next: Set<string>): void {
    if (next.size >= total) {
      onChange(null)
      return
    }
    // Preserve canonical (release) order using allSetIds as the ordering basis.
    onChange(allSetIds.filter((id) => next.has(id)))
  }

  function togglePack(id: string): void {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    emit(next)
  }

  function setGroup(packIds: string[], on: boolean): void {
    const next = new Set(selected)
    for (const id of packIds) {
      if (on) next.add(id)
      else next.delete(id)
    }
    emit(next)
  }

  const summary = allowAll
    ? 'All packs allowed'
    : selectedCount === 0
      ? 'No packs — all cards hidden'
      : `${selectedCount} of ${total} packs`

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: '1rem' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          background: '#f9fafb',
          border: 'none',
          borderRadius: 6,
          padding: '0.6rem 0.8rem',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <span style={{ fontWeight: 600 }}>
          Pack legality{' '}
          <span style={{ fontWeight: 400, opacity: 0.7 }}>· {summary}</span>
        </span>
        <span style={{ opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ padding: '0.6rem 0.8rem' }}>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', opacity: 0.75 }}>
            Choose which packs the card picker shows. This filters the builder
            only — cards already in the deck from a deselected pack are kept and
            are not flagged.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.8rem', fontSize: '0.85rem' }}>
            <button type="button" style={linkBtn} disabled={disabled} onClick={() => onChange(null)}>
              Select all
            </button>
            <button type="button" style={linkBtn} disabled={disabled} onClick={() => onChange([])}>
              Deselect all
            </button>
          </div>

          {groups.map((group) => {
            const groupIds = group.packs.map((p) => p.id)
            const inGroup = groupIds.filter((id) => selected.has(id)).length
            const allOn = inGroup === groupIds.length
            const noneOn = inGroup === 0
            return (
              <section key={group.key} style={{ marginBottom: '0.9rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #f0f0f0',
                    paddingBottom: '0.2rem',
                    marginBottom: '0.35rem',
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>
                    {group.label}{' '}
                    <span style={{ fontWeight: 400, opacity: 0.6, fontSize: '0.8rem' }}>
                      ({inGroup}/{groupIds.length})
                    </span>
                  </h4>
                  <span style={{ fontSize: '0.8rem' }}>
                    <button
                      type="button"
                      style={{ ...linkBtn, opacity: allOn ? 0.4 : 1 }}
                      disabled={disabled || allOn}
                      onClick={() => setGroup(groupIds, true)}
                    >
                      all
                    </button>
                    {' / '}
                    <button
                      type="button"
                      style={{ ...linkBtn, opacity: noneOn ? 0.4 : 1 }}
                      disabled={disabled || noneOn}
                      onClick={() => setGroup(groupIds, false)}
                    >
                      none
                    </button>
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '0.15rem 0.8rem',
                  }}
                >
                  {group.packs.map((pack) => (
                    <label
                      key={pack.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.85rem',
                        cursor: disabled ? 'default' : 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(pack.id)}
                        disabled={disabled}
                        onChange={() => togglePack(pack.id)}
                      />
                      <span>{pack.name}</span>
                    </label>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
