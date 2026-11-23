# Cairo Metro App: Plan

Repo: C:\Users\Asus\cairo-metro (local; publish to GitHub later). Commit each change separately.
Scope: Cairo Metro Lines 1-3 (+ planned layers later). Web PWA, en/ar (RTL), offline-capable (bundled data).
Stack: Vite + React + TS PWA, pure-TS core, static JSON data, MapLibre/Leaflet, Vitest, i18n. No proxies or external workers (decision): all parsing runs in the client.
Tooling note: pnpm not installed -> using npm workspaces.

## Core user stories

1. Nearest metro station(s) to a place (Google Maps link / text search / map pin / GPS).
2. From -> To metro trip planner: stations count, best routes, transfers, direction, time, fare, door-to-door.

## Data sources

- OSM Overpass (station=subway, route=subway) snapshot -> static JSON (ODbL attribution).
- Official cairometro.gov.eg for fares/maps/verification. No official GTFS.
- Manual curation for interchanges, ride times, transfer times.
- Benchmark app: Egypt Transport (com.megahed.cairometro). DO NOT decompile/copy its data; only compare outputs as a user.

## Repo structure

data/ (raw, curated) | scripts/ (build-data, validate-data) | packages/core | apps/web | workers/ | docs/

## Stages

### Stage 0: Foundations

1. Monorepo (workspaces), TS, lint, formatting, Vitest.
2. CI (lint, test, build).
3. Data/legal notes (OSM attribution, sources).
   Done when: empty app + core build and test in CI.

### Stage 1: Metro data

1. Pull stations + line relations (L1-3) from Overpass into data/raw.
2. Normalize to stations.json (id, en/ar, lat/lng, lines, order) and lines.json (colour, terminals, direction names).
3. Curate interchanges, transfer times, per-segment ride times.
4. Fares/zones and operating hours as separate files.
5. validate-data.ts: duplicate ids, orphans, connected graph, coords in Cairo, both languages.
   Done when: validation passes; matches official map (~85 stations).

### Stage 2: Core engine (packages/core)

1. geo (haversine, bbox)
2. link-parser (@lat,lng, !3d!4d, q=, ll=, place-name fallback)
3. nearest (top-N, pluggable walking-distance provider)
4. graph + routing (Dijkstra, transfer penalty, fastest / fewest transfers)
5. Route output model (legs, direction, stops, interchange, time, fare)
6. Tests: 30+ routes, link formats, edge cases
   Done when: tests pass with no UI.

### Stage 3: Place resolution services

1. No worker/proxy (decision). Short-link handling is fully client-side: Web Share Target text (name + address + link) via `parseSharedText`; a bare short link asks for the place name; Maps coordinates tip.
2. Offline places index (decision: no geocoder service): `npm run data:places` builds `data/places.json` from OSM (ODbL); `createPlaceResolver` in core searches it with the same transliteration-tolerant matching.
3. Walking distance: haversine*1.3 estimate (already in core); real routing only as an optional add-on if ever enabled.
   Done when: pasted/shared input -> coords or a clear next step; fully offline.

### Stage 4: Web MVP

1. Shell: routing, theme, i18n en/ar RTL.
2. Map component (coloured lines, markers).
3. Nearest Station page.
4. Trip Planner page.
5. Station detail sheet.
   Done when: both user stories work end to end on mobile.

### Stage 5: Product polish

1. PWA manifest + service worker + offline data.
2. Web Share Target (Maps/WhatsApp).
3. Saved trips, recents, shareable route URLs.
4. Fare + subscription calculator.
5. Door-to-door totals.
6. Accessibility + Lighthouse.

### Stage 6: Quality & benchmark

1. Compare 20-30 trips vs Egypt Transport app + official map -> docs/benchmark.md.
2. Fix data/weights.
3. Issue-report flow (prefilled GitHub issue/form).

### Stage 7: Later

LRT/Monorail/Lines 4+ layers; hours + leave-now ETA; reachable-in-N-stops; native wrapper for pre-stop alert; last-mile suggestions; women-only cars/accessibility/exits info; crowd/disruption notes; subscription advisor.

## Open decisions

- Project name (default: cairo-metro), hosting (default Cloudflare Pages), exits/facilities in Stage 1 or later.

## Risks

OSM gaps; no official timetable/real-time data (times are estimates); Maps link format variety; Google Maps API is paid (avoid).

## Progress

- [x] Stage 0 (monorepo, tooling, core haversine, web shell, CI, data notes)

### Stage 1 addendum: sources + verification visualizer

Sources (in priority order): (1) OSM Overpass, (2) official cairometro.gov.eg (station lists, fares, hours, map PDF), (3) Wikipedia/Wikidata for cross-check of names and order, (4) GitHub/Transitland/Mobility DB search for existing open datasets (license-checked), (5) manual curation for ride/transfer times.
Verification: a dev-only data visualizer (apps/web /admin/data or standalone page) showing the map, per-line station lists, diffs vs. cross-check sources, validation errors, and per-station verified flag. Data files carry a `verified` field + `sources` per record; nothing ships as verified until the user approves.

- [x] Stage 1 (metro data) done: OSM + Wikidata pipeline, validation, verification viewer (`npm run data:view`), manual station verification applied; 84 stations / 5 interchanges / L1 35, L2 20, L3 34. Fares (`data/curated/fares.json`) and operating hours (`data/curated/hours.json`) added. Open: station-to-zone data (official zone page is outdated), official L3 hours/headway, exits/facilities (optional, later).
- [x] Stage 2 (core engine) done in `packages/core`: geo (haversine, bbox), `parsePlaceInput` link parser, `nearestStations` (pluggable walking distance), transliteration-tolerant `searchStations`, `buildGraph`/`planRoute`/`planRoutes` (Dijkstra, transfer penalty, fastest and fewest-transfers, L3 branch-change handling at Kit-Kat), `tripFare`/`ticketPrice`. 44 tests, no UI. Notes: times are estimates; fare counts the boarding station (interchange counts once), configurable via `ticket.counting` in `data/curated/fares.json` (confirmed by rider; re-check in Stage 6 benchmark).
- [x] Stage 3 done (core): offline places index (~7.6k places after noise filtering, curated aliases in `data/curated/place-aliases.json`, landmark regression tests; `npm run data:places -- --cached` rebuilds from the cached raw download), `createPlaceResolver`, `parseSharedText`, word-order-tolerant search. UI wiring (Share Target, map pin) comes in Stages 4-5.
- [x] Stage 4 done: web MVP (i18n en/ar RTL, dark/light theme), own Leaflet map with optional OSM tiles and tappable stations, nearest page, trip planner (door-to-door over the 3 nearest stations per end, fastest + fewest transfers, fare, step list, walk-instead hint under 700 m). Review fixes: input editing, stale GPS, resolver cache/failure message. Verified by scripted browser check at 390 px in EN and AR (no overflow). Follow-ups: station aliases such as Tahrir for Sadat, web lifecycle tests, Stage 6 benchmark vs the Egypt Transport app (black-box).

### Future ideas (not scheduled)

- **Monthly data refresh via GitHub Action:** scheduled workflow runs `npm run data:places` (and `data:fetch` + `data:build` + `data:validate`), and opens a PR with the diff for manual review. Never auto-merge; keep `verification.json` untouched. Measured OSM growth of our place categories: ~+3.5% per 6 months (8,672 -> 8,966 -> 9,277 between 2025-11 and 2026-11, net count).
- **Optional resolver worker (Vercel/GitHub/etc.):** a small self-hosted function that expands short Maps links (and possibly caches geocoding). Strictly opt-in and configurable (endpoint in settings), never required; the app must keep working without it. Discuss design later.
