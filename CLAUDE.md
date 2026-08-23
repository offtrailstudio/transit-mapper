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

## Simulation: three modes on one clock

**The simulation is always mounted — it has no off state, only a pause.** The
editor opens with the clock at 00:00, paused, on the network view, and
`SimControls` (the playback bar) is on screen from the first paint. There is no
"Simulate" button and no exit: pressing **play** is what hands the map over.
`editingLocked` (on `useSimMode()`) is that handover — `playing || viewMode !==
"network"` — and it's what gates map editing (`MapEditor`'s pin click,
`StationsLayer`'s draggable markers). Paused on the network view *is* the editor's
resting state.

Two consequences worth remembering:

- **The rAF loop only runs while playing**, so anything that moves the clock or
  the data while paused has to repaint the vehicles itself: `publishFrame()` fans
  the current time out to every subscriber (used by `reset`, by the follow-route
  clock restart, and by `VehiclesLayer` when the schedules change). A paused
  editor must not burn a frame callback sixty times a second.
- `VehiclesLayer`/`FollowCamera` are mounted unconditionally, and `VehiclesLayer`
  paints once as soon as its layer is added — otherwise a paused sim shows an
  empty map until you press play.

`SimModeContext` owns that rAF loop and one `simSecondsRef` — everything animated
subscribes to it (`subscribeFrame`) and drives the map *imperatively*. Never
animate through React state; `VehiclesLayer` and `FollowCamera` both read their
inputs through refs so a data change can't tear down a live subscription.

`viewMode` (`network | follow | timetable`) is **one enum**, not a mode flag per
feature. That's deliberate:

- Every mode runs on the same clock — pause, speed and reset apply to all three.
- **The mode menu sits in the map's top-left** (`ViewModeMenu`, mounted by
  `AppShell`), not in the playback bar: the bar is only the clock's transport
  (play/pause, speed, reset, settings), and the mode belongs with the map it
  changes — opposite `FollowRoutePicker` in the top-right, so "what am I looking
  at" and "which route" are matching pills at either end of the same edge. It
  wears the *current* mode's name and icon, which is what keeps the way out
  visible: the control you press to leave Follow is the one telling you you're in
  it. Because it floats over the timetable too (z-40 over that view's z-20), the
  timetable has **no heading of its own** — the pill already says "Timetable" and
  is how you leave; its header keeps a fixed `h-16` so the route picker still
  lines up with the pill.
- Esc peels off one layer (focused mode → network) as a single ordinary handler;
  on the network view it does nothing, since there's nothing left to leave. The
  previous split `TimetableModeContext` needed a capture-phase
  `stopImmediatePropagation` to stop two providers answering Esc at once; that
  whole hack is gone.

**`focusRouteId` is shared by Follow and Timetable** — the route you're reading a
schedule for is the route you then watch run, so switching modes keeps your
subject. Resolve it through **`useFocusRoute()`**, never the raw id: it falls back
to the sidebar's `activeRouteId` and then the first route, so a focused mode opens
on the route you were already working on and a deleted route degrades to a
sensible one. `ViewModeMenu` commits that resolved id on entering a focused mode,
which is what lets the clock rule below tell a new subject from a re-entry.

**Mode and route stay two separate controls.** Folding routes into the view menu
as a submenu was considered and rejected: changing route would mean reopening a
menu and walking into a nested level, touch targets get bad on mobile, and it
re-fuses the two jobs whose entanglement made leaving Follow hard to find.

**`route.hidden` excludes a route from the focused modes**, matching the field's
own definition ("hidden from the live map *and simulation*"). `useFollowRun`
returns null for one and `TimetableView` says so, rather than following an
invisible line — a real regression once, when unifying the pickers dropped the
filter the old follow menu had. The picker still *lists* hidden routes, disabled
with an eye-off icon: dropping them reads as deletion.

**The sidebar marks the focused route but does not set it.** `RouteListItem` shows
a ring + mode icon while a focused mode runs. It stays read-only deliberately —
the sidebar is behind a map-covering sheet on mobile (so it can never be the only
selector), `activeRouteId` means "expanded for editing" rather than "being
watched", and a row click already expands the editor, so overloading it would mean
peeking at a route's stops yanks the camera onto a different vehicle.

Rendering per mode:

- **network** — `buildRouteSchedules` → `vehiclePositions`: every route, vehicles
  spaced by headway, dwelling only at *intermediate* stops.
- **follow** — `src/lib/followAlong.ts`: **one** vehicle on **one** route, holding
  at **every** stop (origin and terminus included), then looping. The origin hold
  gives the run a readable first beat. **The clock restarts only when the followed
  route changes** — stepping out to the network and back must not throw away your
  place.

  **The dwell is the one duration measured in _real_ seconds**
  (`FOLLOW_DWELL_REAL_SECONDS`, converted by `followDwellSeconds(multiplier)`).
  The hold exists to be *read*, and readability is wall-clock, so a value fixed in
  simulated seconds can't survive the speed control: 20 sim-seconds played as a
  comfortable 4s at 5× but a measured **332ms** at the 60× default — no pause at
  all. Scaling it holds the same beat at every step (measured within 8ms across
  60× and 10×).
  Two consequences, both accepted: the sim clock gallops while following (two
  simulated minutes per stop at 60×), and changing speed rebuilds the timeline so
  the vehicle steps once. Follow's timeline is synthetic anyway — no real schedule
  holds at its own terminus — and the timetable runs off `buildRouteSchedule`, not
  this, so printed times stay honest.
- **timetable** — `TimetableView` covers the map (`absolute inset-0`), driven by
  the same `buildRouteSchedule` engine so a printed timetable can't disagree with
  the vehicles.

`buildFollowTimeline(schedule)` → arrival/departure seconds per stop;
`sampleFollow(schedule, timeline, simSeconds)` → position plus the stop being held
at *or approached*. Both are pure and read `RouteSchedule.stopIds` /`stopMeters`
/`speedMps`, so the run can only ever name stops the drawn geometry reached.
`useFollowRun()` resolves route + schedule + timeline + stop names once, and the
camera (`FollowCamera`), the vehicle layer and the readout (`FollowBanner`) all
share it — three separate builds would drift apart on a data change.

`RoutePicker` is one component with a `tone` prop, mounted **top-right in both
focused modes** — the timetable's own header (`panel`) and a map overlay while
following (`overlay`, via `FollowRoutePicker`) — so "which route am I looking at"
never moves between modes. `overlay` carries its own dark pill: it stands alone on
the basemap, where the sim bar's translucent fill would leave white text on a pale
map. Both mounts drop their menu downward and right-aligned. The follow banner
deliberately does **not** name the route (the picker beside it already does);
it shows the colour dot, `Stop n of N`, and the held/approached stop.

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
