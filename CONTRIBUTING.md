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

## Adding a preset route

Preset routes (the networks in the "Add a preset route" picker) live in
`src/lib/presets/routes/<network>/`. To add one:

1. Add a `PresetRoute` file under the right network folder and register it in
   `src/lib/presets/index.ts`. If it's a new network, add a `PresetGroup` to
   `groups.ts` (give it a `defaultRouteType` so every route in it gets a transit
   mode). `presets.schema.json` documents the shape.
2. Run `npm run build:catalog` — it assembles the catalog, runs
   `validatePresetCatalog`, and writes `catalog-dist/`. This is what CI checks, so
   a transposed lng/lat or a route with fewer than two stops fails the build.
3. `npm test` covers the catalog invariants (unique ids, plausible coordinates).

> The catalog is **host-injectable** — apps can serve their own via
> `MapDataProvider`'s `presets` prop. The bundled catalog here is the default
> fallback; over time the source of truth moves to a dedicated data repo that
> reuses this same `build-catalog` script and schema.

## Pull requests

1. Fork and branch.
2. Make the change with a test that covers it.
3. Ensure `npm run typecheck`, `npm test`, and `npm run build` pass.
4. Open a PR describing the "why".

## Reporting bugs

Open an issue with a minimal reproduction (a small `TransitMapData` and the
expected vs. actual behavior is ideal).
