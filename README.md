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
