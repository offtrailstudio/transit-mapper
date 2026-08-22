# Contributing

Thanks for your interest in improving the transit mapper editor!

## Getting started

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest (pure logic + component tests)
npm run build       # bunchee -> dist/ (ESM + types, "use client" preserved)
```

The editor is a React component library — no app or server. Tests use vitest +
Testing Library (jsdom); anything that renders the map mocks `react-map-gl`.

## Conventions

- TypeScript strict, no `any`.
- Named exports only.
- `"use client"` only on components that need interactivity/hooks/browser APIs.
- Tests live next to the code (`*.test.ts` / `*.test.tsx`).
- Keep the domain model GTFS-shaped; keep presentation/derived state out of it.
- The public API is `src/index.ts` — add exports there when you expose something.

## Route data (the "Add a route" picker)

The picker searches a `RouteSource` (see the README). Routes ultimately come from
a normalized, GTFS-aligned **v2** `RouteCatalog` (`schemaVersion: 2`): a shared
`stops` table plus `routes` whose ordered sequences live in `patterns` — a strict
projection of the editor's own `TransitMapData`. See `presets.schema.json` and
`src/lib/presets/catalog.ts`.

Two ways a static catalog gets built:

- **From live GTFS (preferred).** `src/gtfs/` ingests feeds from the
  [Mobility Database](https://mobilitydatabase.org): the curated networks live in
  `src/gtfs/networks.ts`. Set `MOBILITY_DATABASE_REFRESH_TOKEN` (from your
  account, in `.env.local` — never commit it) and run `npm run build:catalog` to
  assemble `catalog-dist/` from real feeds. Each route's trips collapse to
  representative patterns; GTFS `route_type` maps to the editor's mode via
  `src/gtfs/routeType.ts` (routes with no editor equivalent are dropped).
- **From the bundled fallback.** Without the token, `build:catalog` builds from
  the hand-authored routes in `src/lib/presets/routes/<network>/`. Those use the
  flat **legacy** authoring shape (`LegacyRoute`, stops embedded per route) and
  are upgraded to v2 by `upgradeLegacyCatalog`. To add one, drop a `LegacyRoute`
  file under the right network folder, register it in `src/lib/presets/index.ts`,
  and add a `RouteNetwork` to `groups.ts` for a new network.

Either way, `npm run build:catalog` runs `validateRouteCatalog` (a bad
coordinate, a <2-stop pattern, or a dangling stop reference fails the build) and
`npm test` covers the catalog + GTFS-transform invariants. For *live* search
(any route, not just the bundled set), a host mounts
`createMobilityDatabaseHandler` and passes `mobilityDatabaseRouteSource` to
`MapDataProvider`'s `routeSource` prop; the bundled catalog is the zero-config
fallback. A pre-v2 catalog a host already pinned is auto-upgraded on load.

## Pull requests

1. Fork and branch.
2. Make the change with a test that covers it.
3. Ensure `npm run typecheck`, `npm test`, and `npm run build` pass.
4. Open a PR describing the "why".

## Reporting bugs

Open an issue with a minimal reproduction (a small `TransitMapData` and the
expected vs. actual behavior is ideal).
