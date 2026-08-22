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

## Preset catalog (the "Add a preset route" picker)

The catalog is a normalized **v2** projection of `TransitMapData`:
`{ schemaVersion: 2, groups, stops[], routes[] with patterns[] of stopIds }`.
Defined in `src/lib/presets/catalog.ts`; JSON Schema in `presets.schema.json`.

- Host-injectable via `MapDataProvider`'s `presets` prop (object or async loader);
  `createRemotePresetLoader(url)` fetches + validates. Route data changes without
  a package release.
- `validatePresetCatalog` accepts v2 natively **and** upgrades a pinned v1
  (`schemaVersion: 1`, flat stops) via `upgradeLegacyCatalog` — non-breaking.
- Application to a map uses `resolvePresetRoute(catalog, route)` → a
  `ResolvedPresetRoute` (primary pattern flattened to an inline stop list). The
  reducer's `ADD_PRESET_ROUTE` and the picker/merge modals work on that.
- **Legacy authoring bridge:** the bundled fallback routes in
  `src/lib/presets/routes/<network>/` are the flat `LegacyPresetRoute` shape
  (stops embedded), upgraded to v2 at assembly time. They're temporary — the
  source of truth is moving to live GTFS. `PRESET_SCHEMA_VERSION` lives in
  `types.ts` (leaf) to avoid a `legacy`↔`catalog` import cycle.

## GTFS ingest (`src/gtfs/`, exported as `@offtrailstudio/transit-mapper/gtfs`)

Server/build-time subpath export (`dist/gtfs.js`, kept out of the browser entry).
The **host holds the Mobility Database token** and calls `assembleCatalog({
refreshToken })` — same ownership model as the Mapbox token. `fflate`/`csv-parse`
are **optional peerDependencies** (bunchee externalizes them; the `.` browser
bundle never imports them). Kept in devDependencies so this repo builds/tests.

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
