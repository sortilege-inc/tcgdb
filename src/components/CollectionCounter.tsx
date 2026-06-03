import * as React from 'react'
import { useSidecarState } from '../state/SidecarStateProvider'
import { useConflictReporter } from '../state/ConflictReporter'

interface Props {
  gameId: string
  cardId: string
  qty: number
  promoQty: number
  expected?: number
  unverified?: boolean
}

/**
 * Two side-by-side counters (regular + promo) for a single card.
 * Talks to the sidecar via the SidecarStateProvider.
 */
export function CollectionCounter({
  gameId,
  cardId,
  qty,
  promoQty,
  expected,
  unverified,
}: Props): React.ReactElement {
  const { setCollectionEntry, readOnly } = useSidecarState()
  const { reportIfConflict } = useConflictReporter()
  const [busy, setBusy] = React.useState(false)

  async function adjust(field: 'qty' | 'promoQty', delta: number): Promise<void> {
    if (readOnly) return
    setBusy(true)
    try {
      const next = Math.max(0, (field === 'qty' ? qty : promoQty) + delta)
      await setCollectionEntry(gameId, cardId, { [field]: next })
    } catch (err: unknown) {
      const handled = reportIfConflict(err, {
        gameId,
        title: 'Can’t decrease that count',
        description:
          'A built deck claims more copies of this card than the new total would allow. Unbuild the deck (or one of the conflicting decks below) first, then try again.',
        // No cardNames available at this scope; dialog will show the cardId.
      })
      if (!handled) {
        // Optimistic update was already rolled back by SidecarStateProvider.
        // Non-conflict errors just bubble silently — the rollback is the
        // visible signal that the change didn't take.
        // eslint-disable-next-line no-console
        console.warn('[tcgdb] collection adjust failed:', err)
      }
    } finally {
      setBusy(false)
    }
  }

  const status: 'short' | 'ok' | 'over' | 'none' =
    expected == null
      ? 'none'
      : qty < expected
        ? 'short'
        : qty > expected
          ? 'over'
          : 'ok'

  const statusBg =
    status === 'short' ? 'rgba(192, 57, 43, 0.18)'
    : status === 'over' ? 'rgba(41, 128, 185, 0.18)'
    : status === 'ok'   ? 'rgba(39, 174, 96, 0.18)'
    : 'transparent'

  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      {unverified && (
        <span
          title="Unverified — count came from an external import and hasn't been confirmed."
          aria-label="unverified"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.1rem',
            height: '1.1rem',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'var(--theme-text)',
            background: 'transparent',
            border: '1px dashed var(--theme-text-muted, #9aa1ad)',
            borderRadius: '50%',
            opacity: 0.75,
            cursor: 'help',
          }}
        >
          ?
        </span>
      )}
      <Counter
        label="qty"
        value={qty}
        expected={expected}
        bg={statusBg}
        disabled={busy || readOnly}
        onDec={() => adjust('qty', -1)}
        onInc={() => adjust('qty', +1)}
      />
      <Counter
        label="promo"
        value={promoQty}
        bg="transparent"
        muted
        disabled={busy || readOnly}
        onDec={() => adjust('promoQty', -1)}
        onInc={() => adjust('promoQty', +1)}
      />
    </div>
  )
}

interface CounterProps {
  label: string
  value: number
  expected?: number
  bg: string
  muted?: boolean
  disabled?: boolean
  onDec: () => void
  onInc: () => void
}

function Counter({
  label, value, expected, bg, muted, disabled, onDec, onInc,
}: CounterProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        background: bg,
        border: '1px solid var(--theme-border)',
        borderRadius: 6,
        padding: '0.1rem 0.25rem',
        opacity: muted ? 0.85 : 1,
      }}
    >
      <button
        type="button"
        onClick={onDec}
        disabled={disabled || value <= 0}
        style={btnStyle}
        aria-label={`${label} decrement`}
      >
        −
      </button>
      <span
        style={{
          minWidth: '2.25rem',
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
          fontSize: '0.9rem',
        }}
        title={label}
      >
        {value}
        {expected != null && (
          <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>/{expected}</span>
        )}
      </span>
      <button
        type="button"
        onClick={onInc}
        disabled={disabled}
        style={btnStyle}
        aria-label={`${label} increment`}
      >
        +
      </button>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '0 0.4rem',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.95rem',
  lineHeight: 1,
}
