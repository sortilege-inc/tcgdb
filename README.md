# tcgdb

Personal multi-game TCG collection, deckbuilding, and inventory tracker.
Single-user, Gatsby + GraphQL, with a local Node sidecar for mutation.

See [docs/plans/](docs/plans/) for the project plan.

## Quick start

```bash
nvm use            # if you use nvm; otherwise ensure Node >= 20
npm install
npm run develop
```

This starts both Gatsby (`http://localhost:8000`) and the sidecar API
(`http://localhost:8001`) together. Visit `http://localhost:8000`.

## Scripts

| Script | What it does |
|---|---|
| `npm run develop` | Run Gatsby dev server + sidecar concurrently |
| `npm run develop:gatsby` | Gatsby dev only |
| `npm run develop:sidecar` | Sidecar only (with watch reload) |
| `npm run build` | Static production build (`gatsby build`) |
| `npm run serve` | Serve the production build locally |
| `npm run clean` | Wipe Gatsby cache |
| `npm run typecheck` | Run `tsc --noEmit` over the project |
| `npm run sidecar` | Sidecar one-shot (no watch) |

## Layout

```
data/            Canonical JSON state (committed)
sidecar/         Local mutation API (Express)
src/             Front-end (Gatsby + React + TS)
  games/         Per-game modules (rules, search, display)
  components/    Shared UI
  state/         React context + sidecar client
  pages/         Gatsby file-system routes
  templates/     Page templates used by gatsby-node.ts
docs/plans/      Project plan documents
unsorted/        Existing reference material (L5R inventory, Netrunner notes)
```

## Read-only mode

A deployed build is read-only by design. Mutation UI is hidden when
`GATSBY_READ_ONLY=true` at build time:

```bash
GATSBY_READ_ONLY=true npm run build
```
