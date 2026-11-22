# Cairo Metro

Find the nearest Cairo Metro stations to any place and plan metro trips (stations count, transfers, direction, time, fare).

- Scope: Lines 1-3 first; LRT/Monorail/new lines later.
- Web PWA, English + Arabic, offline-capable.
- See [docs/PLAN.md](docs/PLAN.md) for the staged plan and [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for data sources and licensing.

## Layout

```
data/         raw OSM snapshots + curated station/line/fare data
scripts/      data build + validation scripts
packages/core pure TypeScript engine (geo, link parsing, nearest, routing)
apps/web      PWA UI
workers/      serverless helpers (Maps short-link resolver)
docs/         plan, decisions, benchmark
```

## Development

```
npm install
npm run lint
npm test
npm run build
```
