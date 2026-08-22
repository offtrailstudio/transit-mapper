# transit-mapper — project notes

Embeddable GTFS-aligned schematic transit-map editor (React + Mapbox), published
as `@offtrailstudio/transit-mapper`. Storage-agnostic: the host supplies the
Mapbox token, persistence, and the preset catalog.

## Data model is deliberately GTFS-shaped

`src/lib/types.ts` (`TransitMapData` v3) mirrors GTFS: normalized `stops[]`,
`routes[]` (GTFS route), `StopPattern[]` (GTFS trip pattern), `routeType` ↔
`route_type`, `routeColor` ↔ `route_color`, `headwayMin` ↔ `frequencies.txt`.
Keep new modeling aligned with GTFS; simplify only where it clearly helps.

`RouteType` is a coarse 6-value enum (`bus tram subway ferry rail hsr`) driving
sim speed + picker label. GTFS `route_type` is an integer space; the mapping
(basic 0–12 + extended HVT 100–1799) lives in `src/gtfs/routeType.ts`. `hsr`
has no GTFS code except extended `101`, so basic-rail HSR is a per-feed override.

## Adding routes: the `RouteSource` seam (the "Add a route" picker)

The picker (`src/components/sidebar/AddRouteModal.tsx`) is **search-first** and
written against one interface: `RouteSource` (`search(query) → RouteSummary[]`,
`resolve(id) → ResolvedRoute`), in `src/lib/presets/routeSource.ts`. The host
passes one via `MapDataProvider`'s `routeSource` prop (`RouteSourceProvider` /
`useRouteSource`); default is the bundled catalog as a static source. Three impls:

- `staticRouteSource(catalog)` — in-memory search over a `RouteCatalog` (zero
  backend). `remoteRouteSource(url)` — fetch+validate a hosted catalog, then static.
- `mobilityDatabaseRouteSource({ endpoint })` — dependency-free client (just
  `fetch`) that calls a host endpoint. Lives in the **main** bundle. Pairs with
  `createMobilityDatabaseHandler` (server, `/gtfs` subpath) which holds the token
  and parses feeds server-side, returning small JSON. Summary ids are
  `${feedId}:${routeId}`; resolve derives the feed id from the prefix.

The underlying **catalog** is still a normalized v2 projection of `TransitMapData`
(`{ schemaVersion: 2, groups, stops[], routes[] with patterns[] of stopIds }`),
`src/lib/presets/catalog.ts` + `presets.schema.json`. `validateRouteCatalog`
accepts v2 and upgrades pinned v1 via `upgradeLegacyCatalog`. Applying a route
uses `resolveCatalogRoute` → `ResolvedRoute` (primary pattern flattened); the
reducer action is `ADD_CATALOG_ROUTE` (`route` field). The bundled fallback routes
in `src/lib/presets/routes/<network>/` are the flat `LegacyRoute` shape, upgraded
at assembly time — temporary; the source of truth is live GTFS. (Folder is still
named `presets/`; only the symbols were renamed off "preset".)

## GTFS ingest (`src/gtfs/`, exported as `@offtrailstudio/transit-mapper/gtfs`)

Server/build-time subpath export (`dist/gtfs.js`, kept out of the browser entry).
The **host holds the Mobility Database token** — either it mounts
`createMobilityDatabaseHandler({ refreshToken })` (live search) or calls
`assembleCatalog({ refreshToken })` (build a static catalog) — same ownership
model as the Mapbox token. `fflate`/`csv-parse` are **optional peerDependencies**
(bunchee externalizes them; the `.` browser bundle never imports them). Kept in
devDependencies so this repo builds/tests.

Pipeline: `mobilityDatabase.ts` (token exchange `POST /v1/tokens/access`, feed
lookup, no-auth `latest_dataset.hosted_url` download) → `parse.ts` (fflate unzip
+ csv-parse) → `transform.ts` (agencies→groups, route_type→mode dropping
untypable routes, trips→representative patterns with opposite directions merged,
pruned shared stop table) → `assemble.ts` (combine fragments → validate).
`networks.ts` is the curated allow-list (feeds by provider name or pinned
`feedId`; pin ids once confirmed for reproducible builds).

`scripts/build-catalog.ts` is a thin CLI (`npm run build:catalog`) over
`assembleCatalog` — uses live GTFS when `MOBILITY_DATABASE_REFRESH_TOKEN` is set,
else the bundled fallback (what CI validates). The token value belongs in the
host app (transit-league-website), not here.

## Conventions

TS strict, no `any`. Named exports. Tests colocated (vitest). Run `npx tsc
--noEmit` and `npx vitest run` before finishing; `npm run build` (bunchee) must
stay cycle-warning-free.
