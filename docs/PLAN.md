# Cairo Metro App: Plan

Repo: C:\Users\Asus\cairo-metro (local; publish to GitHub later). Commit each change separately.
Scope: Cairo Metro Lines 1-3 (+ planned layers later). Web PWA, en/ar (RTL), offline-capable (bundled data).
Stack: Vite + React + TS PWA, pure-TS core, static JSON data, MapLibre/Leaflet, Vitest, i18n, Cloudflare Worker for link expansion.
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

1. workers/resolve-link: follow short-link redirect, parse.
2. Geocoder adapter (Nominatim/Photon), cache, debounce.
3. Walking-route adapter (OSRM/ORS) with haversine*factor fallback.
   Done when: short Maps link -> coords; graceful offline degrade.

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
