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
  RailShell, RailDivider, UndoButton, RedoButton, SimulateButton, ExportButton,
} from "@offtrailstudio/transit-mapper";

function Rail() {
  return (
    <RailShell>
      <UndoButton />
      <RedoButton />
      <RailDivider />
      <SimulateButton />
      <ExportButton />
    </RailShell>
  );
}
```

### Preset routes

Preset routes (the **Add a preset route** modal) are **optional** and
**host-supplied**. The modal groups routes by network, is searchable, and shows
each route's default transit mode. Each route resolves a mode from, in order: its
own `routeType`, its group's `defaultRouteType`, then the editor default.

**The catalog is host-injectable so it isn't tied to the package version.** Pass
your own catalog to `MapDataProvider`; omit it and the editor falls back to a
small bundled catalog. Serve the catalog JSON from your own app so updating routes
is a redeploy, not an `npm` release:

```tsx
import { createRemotePresetLoader } from "@offtrailstudio/transit-mapper";

// Fetched lazily the first time the modal opens, then cached. The payload is
// validated (see PresetCatalog / PRESET_SCHEMA_VERSION); a bad shape shows an
// error with a retry rather than breaking the editor. Point it at a JSON file
// your app serves (pin an immutable/versioned URL so an update never lands
// silently).
const loadPresets = createRemotePresetLoader("/presets.v2.json");

<MapDataProvider presets={loadPresets}>…</MapDataProvider>;
```

`presets` accepts either a `PresetCatalog` object or a (sync or async) loader
returning one. Omit it to use `DEFAULT_PRESET_CATALOG` (the bundled routes).

**Building a catalog from live GTFS.** A server-only subpath,
`@offtrailstudio/transit-mapper/gtfs`, assembles a validated catalog from real
[Mobility Database](https://mobilitydatabase.org) feeds. Like the Mapbox token,
the **host holds the Mobility Database token** and passes it in — the package
provides the capability, your app provides the secret:

```ts
// Server/build-time only (e.g. a build script or a cached server route).
import { assembleCatalog } from "@offtrailstudio/transit-mapper/gtfs";

const catalog = await assembleCatalog({
  refreshToken: process.env.MOBILITY_DATABASE_REFRESH_TOKEN!, // your app's env
});
// Write catalog to a JSON file you serve, or return it from a cached endpoint,
// then load it in the client with createRemotePresetLoader(...).
```

The `/gtfs` entry needs `fflate` + `csv-parse` (optional peer deps — install them
only if you build catalogs). It's kept out of the browser bundle. A free Mobility
Database account provides the refresh token; without a catalog, presets simply
stay empty (the modal still works). The repo's own `npm run build:catalog` wraps
this same function for the bundled fallback + CI validation.

To offer only some of the *visible* networks, pass a `presetGroups` allowlist of
group ids:

```tsx
<EditorConfigProvider config={{ mapboxToken, presetGroups: ["amtrak"] }}>
```

An empty array hides every preset.

**Letting users paste a GTFS link (opt-in).** The picker can show a field where
a user pastes any no-auth GTFS `.zip` URL (including a Mobility Database
`latest_dataset.hosted_url`); its routes are fetched, parsed, and transformed in
the browser and added to the picker. It's **off by default** because it lazy-loads
the GTFS parser, which needs two optional peer deps:

```bash
npm install fflate csv-parse
```

```tsx
<EditorConfigProvider config={{ mapboxToken, enableFeedImport: true }}>
```

The parser loads only when someone actually pastes a link (a dynamic `import()`),
so it never touches your initial bundle. Note: the browser fetches the feed
directly, so a host without CORS headers will fail — the control surfaces that
inline. For always-on reliability, proxy the download through your own app and
have users paste the proxied URL.

`PRESET_LINES`, `PRESET_GROUPS`,
`DEFAULT_PRESET_CATALOG`, `groupPresetRoutes`, `resolvePresetRouteType`,
`validatePresetCatalog`, `createRemotePresetLoader`, and `ROUTE_TYPES` (the valid
`routeType` values) are all exported if you want to build your own catalog or
picker.

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
