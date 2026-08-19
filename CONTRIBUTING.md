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

## Pull requests

1. Fork and branch.
2. Make the change with a test that covers it.
3. Ensure `npm run typecheck`, `npm test`, and `npm run build` pass.
4. Open a PR describing the "why".

## Reporting bugs

Open an issue with a minimal reproduction (a small `TransitMapData` and the
expected vs. actual behavior is ideal).
