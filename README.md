# @offtrailstudio/transit-mapper

An embeddable, GTFS-aligned schematic transit-map editor for React — place
stations on a Mapbox map, group them into colored lines, reorder stops, run a
live vehicle simulation, and export print-ready geographic or Vignelli-style
schematic diagrams.

This is the editor that powers [transitleague.com](https://www.transitleague.com).
It's storage-agnostic: the host app supplies the Mapbox token, persistence, and
any cloud/sharing/routing around it.

## Install

```bash
npm install @offtrailstudio/transit-mapper
```

Peer dependencies (bring your own):

```bash
npm install react react-dom mapbox-gl react-map-gl
```

You also need a [Mapbox access token](https://account.mapbox.com/access-tokens/).

## Usage

The editor renders inside your app. Wrap it in `EditorConfigProvider` (the
Mapbox token) and `MapDataProvider` (document state), then mount `AppShell` with
`MapEditor` as its child. `AppShell` takes a host-composed `rail` (toolbar) so
your app decides which tools/actions appear; pass `null` for none, or compose
one from the exported primitives.

```tsx
"use client";

import {
  EditorConfigProvider,
  MapDataProvider,
  AppShell,
  MapEditor,
} from "@offtrailstudio/transit-mapper";

export function Editor() {
  return (
    <EditorConfigProvider config={{ mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN }}>
      <MapDataProvider>
        <AppShell rail={null}>
          <MapEditor />
        </AppShell>
      </MapDataProvider>
    </EditorConfigProvider>
  );
}
```

By default `MapDataProvider` is **ephemeral** (in-memory, no persistence). To
persist, inject your own storage:

```tsx
<MapDataProvider
  loadInitial={loadProjects}   // () => ProjectsFile   (localStorage helpers are exported)
  persist={saveProjects}       // (file) => void
  useSync={useYourCloudSync}   // optional cloud sync hook
>
```

`loadProjects` / `saveProjects` (localStorage) and the cloud-reconciliation
helpers are exported if you want them.

### Composing a toolbar

The rail is yours to compose from editor-intrinsic primitives plus your own
buttons:

```tsx
import {
  RailShell, RailDivider, UndoButton, RedoButton, ExportButton,
} from "@offtrailstudio/transit-mapper";

function Rail() {
  return (
    <RailShell>
      <UndoButton />
      <RedoButton />
      <RailDivider />
      <ExportButton />
    </RailShell>
  );
}
```

The rail has no simulation button: the simulation is always mounted, paused on
the network view, and owns its own chrome over the map — a view menu (network /
follow / timetable) in the top-left and the playback bar along the bottom.
Pressing play is what takes the map over; paused on the network view, it's a
plain editor.

### Adding real routes

The **Add a route** picker is search-first: the user types a network or route
name, sees matching real routes, and clicks one onto the map. It's driven by a
single pluggable **`RouteSource`** you pass to `MapDataProvider` — so the same UI
works over a fixed catalog or a live, searchable data source.

```ts
type RouteSource = {
  search(query: string, opts?: { signal?: AbortSignal }): Promise<RouteSummary[]>;
  resolve(id: string, opts?: { signal?: AbortSignal }): Promise<ResolvedRoute>;
};
```

**1. Zero config.** Omit `routeSource` and the editor searches a small bundled
catalog — a good demo, but "just a few routes".

**2. Your own catalog.** Wrap a catalog (or a hosted JSON URL) in a static source:

```tsx
import { staticRouteSource, remoteRouteSource } from "@offtrailstudio/transit-mapper";

<MapDataProvider routeSource={staticRouteSource(myCatalog)}>…</MapDataProvider>
// or fetch + validate + cache a hosted catalog JSON:
<MapDataProvider routeSource={remoteRouteSource("/routes.v2.json")}>…</MapDataProvider>
```

**3. Live Mobility Database — any real route.** To let users search *all* of the
[Mobility Database](https://mobilitydatabase.org), pair a client source with a
server handler you mount. Like the Mapbox token, **your app holds the Mobility
Database token**; the package provides the handler. Parsing runs server-side, so
the browser only sees small JSON (no multi-MB feeds, no CORS).

```tsx
// Client:
import { mobilityDatabaseRouteSource } from "@offtrailstudio/transit-mapper";
<MapDataProvider routeSource={mobilityDatabaseRouteSource({ endpoint: "/api/routes" })}>…</MapDataProvider>
```

```ts
// Server — e.g. a Next.js route handler at app/api/routes/route.ts. It holds the
// token and does the GTFS parsing. Needs the optional peer deps fflate + csv-parse.
import { createMobilityDatabaseHandler } from "@offtrailstudio/transit-mapper/gtfs";
export const GET = createMobilityDatabaseHandler({
  refreshToken: process.env.MOBILITY_DATABASE_REFRESH_TOKEN!,
});
```

The handler is a web-standard `(Request) => Response`, so it also runs on Hono,
Bun, Deno, or Cloudflare Workers. Mobility Database search is agency-level, so a
query matches a *network* (e.g. "Amtrak", "BART") and returns its routes; parsed
feeds are cached per process (put a CDN in front for shared caching).

**Restrict the offered networks** by id (works for any source that populates
`networkId`):

```tsx
<EditorConfigProvider config={{ mapboxToken, routeNetworks: ["amtrak"] }}>
```

**Build a static catalog from live GTFS** (server/build-time) with
`assembleCatalog({ refreshToken })` from the `/gtfs` subpath — write the result
to a JSON file and serve it via `remoteRouteSource`. The repo's own
`npm run build:catalog` wraps this for the bundled fallback + CI validation.

`staticRouteSource`, `remoteRouteSource`, `mobilityDatabaseRouteSource`,
`BUNDLED_ROUTE_CATALOG`, `validateRouteCatalog`, `resolveCatalogRoute`, and
`ROUTE_TYPES` are all exported if you want to build your own source or catalog.

## Tailwind

The editor's UI is styled with Tailwind utility classes compiled by **your**
app's Tailwind. Because Tailwind skips `node_modules`, point it at this package
so those classes are generated (Tailwind v4):

```css
@import "tailwindcss";
@source "../node_modules/@offtrailstudio/transit-mapper/dist";
```

## Notes

- **Next.js App Router:** all interactive components ship with `"use client"`
  preserved, so they work as client components out of the box.
- **No accounts/cloud built in.** Sharing, auth, and multi-user are the host's
  concern — the editor just emits state you persist however you like.
- **License:** MIT.
