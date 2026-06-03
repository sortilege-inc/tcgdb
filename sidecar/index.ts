import express from 'express'
import cors from 'cors'
import { loadMutableState } from './io/state-loader'
import { collectionRouter } from './routes/collection'
import { decksRouter } from './routes/decks'

const PORT = Number(process.env.SIDECAR_PORT ?? 8001)
const ORIGIN = process.env.SIDECAR_CORS_ORIGIN ?? 'http://localhost:8000'

const app = express()
app.use(cors({ origin: ORIGIN }))
app.use(express.json({ limit: '4mb' }))

app.get('/', (_req, res) => {
  res
    .type('text/plain')
    .send(
      'tcgdb sidecar API (mutation backend).\n' +
        '\n' +
        `The user-facing site is on http://localhost:8000 — you probably want that URL.\n` +
        '\n' +
        'Useful endpoints here:\n' +
        '  GET /api/health\n' +
        '  GET /api/state\n'
    )
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'tcgdb-sidecar' })
})

app.get('/api/state', async (_req, res) => {
  try {
    const state = await loadMutableState()
    res.json(state)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: { code: 'state-load-failed', message } })
  }
})

// Phase 2: collection mutations live here.
app.use('/api/collection', collectionRouter())

// Phase 3: deck CRUD lives here.
app.use('/api/decks', decksRouter())
app.all('/api/prices*', (_req, res) => {
  res.status(501).json({ ok: false, error: { code: 'not-implemented', message: 'Phase 6' } })
})
app.all('/api/wishlist*', (_req, res) => {
  res.status(501).json({ ok: false, error: { code: 'not-implemented', message: 'Phase 7' } })
})
app.all('/api/notes*', (_req, res) => {
  res.status(501).json({ ok: false, error: { code: 'not-implemented', message: 'Phase 8' } })
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[tcgdb-sidecar] listening on http://localhost:${PORT}  (CORS: ${ORIGIN})`)
})
