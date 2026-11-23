# Contributing

Thanks for helping! The app is a web PWA (Vite + React + TypeScript) over a pure-TS core.

## Layout

- `packages/core`: routing, fares, search, schedule (no UI, fully tested)
- `apps/web`: the PWA
- `data/curated`: hand-maintained data (names, fares, hours, verification)
- `scripts`: data pipeline; `docs/PLAN.md`: roadmap

## Setup

```
npm install
npm run dev --workspace apps/web
```

## Before opening a PR

```
npx prettier --write apps packages docs
npm run lint && npm run typecheck && npm test
```

One logical change per commit.

## Data changes

- Edit `data/curated/*`, then `npm run data:build && npm run data:validate`.
- Never edit `data/metro.json` by hand (generated) or `verification.json` (maintainer-approved).
- Cite a source (official site, OSM, a rider's confirmation) in the PR.
- Station names: see `docs/alt-names-review.md` for the alternative-names review.

## Reporting problems

Use "Report a problem" in the app footer; it opens a prefilled GitHub issue.

## Licensing

Code is MIT. Map and place data derive from OpenStreetMap (ODbL); keep the attribution.
Do not copy data from other apps.
