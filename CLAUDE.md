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

## Print export: label placement (`exportGeometry.ts`)

`computeExportLayout` → `ExportLayout` → `buildExportSvg` is a pure pipeline: the
same call renders the download and would render a live preview, so the two can't
drift.

Label placement is **cost-based, not first-fit**. Every candidate slot is scored
(`placementCost`) against the frame, the already-placed labels, the station dots,
the legend card, and the **route segments** — lines are obstacles, which is what
stops names printing over track. The scorer sums rather than tests booleans, so a
station with no perfect slot gets its least-bad one instead of an arbitrary one.
Weights are ordered deliberately: label-on-label ≫ label-on-line, because labels
are drawn with a white halo (readable over a line, unreadable over each other).

- **Every label is radial, on one ring.** Automatic and hand-placed placement are
  the *same function* (`placeAtAngle`) over the same eight bearings
  (`LABEL_BEARINGS`) at the same radius (`metrics.radius`), so a label the placer
  chose is always in a position the rotate control can reach — the point of the
  exercise. `ExportStation.labelAngle` reports the bearing chosen, so the first
  rotate click nudges the label 45° instead of teleporting it.
- **There is deliberately only one ring.** A second, wider one was a useful escape
  for crowded stops (it cut route crossings from 4 to 1 on the reference network)
  but placed labels at a distance no override could reproduce, so rotating one
  yanked it inwards. Consistency won; the per-stop controls handle the strays.
- **Radial text packs better than horizontal**: a name runs *away* from its stop
  rather than sideways across its neighbours, which is why label-on-label
  collisions are zero in both modes. The trade is route crossings — a flat bearing
  runs along the line the stop sits on, and a junction stop can have no clear
  bearing at all.
- Busiest stops (`labelPriority`) are placed first, so file order can't let a
  minor halt take the slot an interchange needed.
- **Schematic**: still one angle + side + ring per straight *run* (that's what
  makes a trunk read as a comb), then a **repair pass** re-places individually the
  few labels a run's single choice left fouled.
- Only label-against-label is scored with `LABEL_PADDING_PX`. A label needs no
  extra clearance from a route or the margin, and demanding it there costs
  placements that were fine.

**Widths are measured, never counted** (`textMeasure.ts`): a canvas is asked for
the real advance width in the font `exportSvg.ts` draws with, memoized per
(text, size, weight, spacing). A character-count estimate is off by ~2× between
"Illinois Institute of Technology" and "WWWWWWWW", and every collision box
inherits that error. `estimateTextWidth` is the fallback for SSR and jsdom (whose
2D context is unimplemented — hence the "Not implemented: getContext" line in
test output, which is the fallback working, not a failure). Because tests run on
the estimate, **the numbers in the realistic-network test are a regression ratchet,
not a prediction of the printed sheet** — verify real output in a browser.

Current state on that network with real metrics: geographic is clean (no label on
another label, none on a route); schematic still leaves ~1 pair and ~3 on-line,
limited by the per-run comb constraint.

## Print view (`components/print/`, `context/PrintModeContext.tsx`)

The printer button no longer opens a modal. It puts the editor into **print
mode**: the sidebar column becomes `PrintPanel` (the sheet's controls) and
`PrintPreview` covers the map area with the sheet itself.

- **The preview is the export.** `usePrintSheet` builds one `ExportLayout` and one
  SVG string; the preview renders that string and Download writes that same
  string (or rasterizes it). There is no second render path, so the preview
  cannot disagree with the file — which is the entire reason the view exists.
- **State lives in `PrintModeContext`**, not in the button. Three separate places
  need it (the rail opens it, the panel edits it, the preview renders it), and
  settings deliberately survive closing print mode so going back to fix a stop
  doesn't discard a tuned sheet.
- **The preview overlays the map rather than replacing it.** Unmounting the WebGL
  map and remounting it on the way back is slow and loses the camera. The sim
  chrome (view menu, follow banner, transport, timetable) hides while printing
  instead of stacking under the sheet.
- **`labelFontSizePx` is a setting, so it can't be a module constant.**
  `labelMetrics()` derives everything that scales with type size (collision-box
  height, the label gap, the above/below offset, the schematic ring offset, the
  edge reservation) once per layout. `ExportLayout` carries the size so
  `exportSvg.ts` draws at exactly what the collision boxes were measured against
  — the two drifting apart is precisely how a "bigger labels" control would
  silently reintroduce the overlap the placer just fixed. Note the diagonal
  slots' own offsets deliberately *don't* scale: those clear the station dot,
  which is the same size whatever the type is.
- The Mapbox basemap raster is cached per URL in `usePrintSheet`, because
  stepping the label size re-lays-out constantly while leaving the bounds alone.

### Per-stop label overrides

Clicking a stop in the preview selects it; `SelectedStopControls` then rotates
its label round the dot in 45° steps, hides it, or resets it to automatic.

- **They live in `TransitMapData.labelOverrides`, not in print settings.** A
  hand-placed label has to survive a reload, sync to the cloud, and sit under
  undo/redo — hence reducer actions (`SET_LABEL_OVERRIDE`, `CLEAR_LABEL_OVERRIDE`,
  `CLEAR_ALL_LABEL_OVERRIDES`) rather than component state. `DELETE_STOP` takes
  the stop's override with it, or it would linger in the file forever and
  reattach if the id were reused.
- **`angle` is a compass bearing — 0 straight up, 90 due right, clockwise,
  snapped to 45°** — and the label *rotates* with it, not merely moves: the
  baseline lies along the ray out of the stop, so rotation is `bearing - 90`
  (due right reads flat, straight up reads vertically, south-east sits at 45°).
  The western half of the dial would leave text upside-down, so `placeAtAngle`
  turns those a further 180° and anchors them at the end instead — every name
  reads left-to-right while still running away from the stop.
  `normalizeMapData` snaps and wraps whatever was in the file.
- **An override is placed first and absolutely**, cost be damned — a placement the
  placer could overrule wouldn't be an override. Its box still joins the obstacle
  set, so automatic labels route around it, and the schematic repair pass skips
  overridden stops entirely.
- **Hiding a label never hides the stop.** The dot still prints, at
  `MINOR_STATION_RADIUS_PX` (55% of full), reading as a minor halt against a
  named interchange. A hidden label also claims *no* collision box, so turning one
  off actively hands its room to its neighbours instead of merely blanking text.
- **Click targets are a separate `<svg>` laid over the sheet**, sharing its
  viewBox so the two align at any scale. They cannot live *inside* the sheet (its
  string must stay byte-identical to what downloads), and they must not be
  appended to it imperatively either: changing the background rewrites the sheet,
  and `dangerouslySetInnerHTML` destroys anything an effect had added — which is
  exactly why selection once worked only in `map` mode and died on the way back
  to `plain`.

### Export/download gotchas worth keeping

- **A print sheet exceeds what some browsers will rasterize.** 18 × 24 at 300 DPI
  is 38.9M px; 24 × 36 is 77.8M. Chrome allows both; **Safari caps a canvas at
  ~16.7M px** and returns a blank or null result *without throwing*, so PNG export
  simply produced nothing there. `usableRasterScale` probes what the browser
  really supports (writing a pixel in the far corner and reading it back — an
  over-large canvas doesn't report failure, it just reads as transparent) and
  steps the raster down, telling the user the DPI it settled for.
- **`downloadBlob` must not revoke the object URL on the next line.** Revoking
  synchronously after `click()` races the browser starting the download, and the
  anchor has to be in the document (a detached one is ignored by Firefox).
- **Never swallow a download error.** `usePrintSheet` surfaces it; a bare
  `try/finally` just resets the button, which is indistinguishable from the click
  doing nothing.

## Conventions

TS strict, no `any`. Named exports. Tests colocated (vitest). Run `npx tsc
--noEmit` and `npx vitest run` before finishing; `npm run build` (bunchee) must
stay cycle-warning-free.
