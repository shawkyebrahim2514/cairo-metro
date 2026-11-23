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

## Data workflow

```
npm run data:fetch      # refresh raw OSM + Wikipedia/Wikidata snapshots (data/raw)
npm run data:build      # build data/metro.json + data/crosscheck.json (applies curated + verification files)
npm run data:places     # rebuild the offline places index data/places.json from OSM
npm run data:validate   # sanity checks (counts, connectivity, names, coordinates)
npm run data:view       # open the verification workspace at http://127.0.0.1:5174
```

Verification progress and name corrections are saved to `data/curated/verification.json` (keyed by Wikidata id).
