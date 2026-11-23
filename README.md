# Cairo Metro

Find the nearest Cairo Metro stations to any place and plan metro trips: stations, transfers, direction, time, fare and door-to-door walking.

Live app: https://shawkyebrahim2514.github.io/cairo-metro/

## Features

- Nearest stations from a Google Maps link, place search, map pin or GPS.
- Trip planner (fastest and fewest transfers), fares by ticket type, service hours and live trip tracking with alerts.
- Metro map tab (schematic diagram), station detail sheet, walking-route links (Google / Apple Maps).
- Shareable trip links, QR codes and a configurable trip image (map styles, long-trip layout, EN/AR).
- Web PWA, English + Arabic (RTL), works offline with bundled data.

See [docs/FEATURES.md](docs/FEATURES.md) for the full guide, [docs/PLAN.md](docs/PLAN.md) for the plan and [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for data sources and licensing. Scope today: Lines 1-3.

## Layout

```
data/         raw OSM snapshots + curated station/line/fare data
scripts/      data build + validation scripts
packages/core pure TypeScript engine (geo, link parsing, nearest, routing, tracking)
apps/web      PWA UI
docs/         plan, features, decisions, benchmark
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
npm run data:places     # rebuild offline places index data/places.json from OSM (add -- --cached to reuse the last download)
npm run data:validate   # sanity checks (counts, connectivity, names, coordinates)
npm run data:view       # open the verification workspace at http://127.0.0.1:5174
```

Verification progress and name corrections are saved to `data/curated/verification.json` (keyed by Wikidata id). Alternative station names live in `data/curated/alt-names.json`.

## Data and licensing

Map and place data come from OpenStreetMap (ODbL, attribution required). See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md). Code is MIT.
