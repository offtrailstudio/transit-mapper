"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RouteSource } from "../lib/presets";

// Lazily build the bundled default source on first use, via a dynamic import.
// This keeps the pure catalog + `staticRouteSource` code out of *this* client
// chunk — critical because the server-only `/gtfs` handler also imports
// `staticRouteSource`; co-bundling it here marks it `"use client"` and Next then
// refuses to run it on the server. The dynamic import forces its own chunk.
let defaultSourcePromise: Promise<RouteSource> | null = null;
function loadDefaultSource(): Promise<RouteSource> {
  return (defaultSourcePromise ??= import("../lib/presets/defaultRouteSource").then(
    (module) => module.DEFAULT_ROUTE_SOURCE,
  ));
}

// A thin proxy so the context always has a value; it defers to the bundled source
// the first time it's searched (a bare embed with no host-provided source).
const DEFAULT_ROUTE_SOURCE: RouteSource = {
  search: (query, opts) => loadDefaultSource().then((source) => source.search(query, opts)),
  resolve: (id, opts) => loadDefaultSource().then((source) => source.resolve(id, opts)),
};

const RouteSourceContext = createContext<RouteSource>(DEFAULT_ROUTE_SOURCE);

/**
 * Supplies the {@link RouteSource} the "Add a route" picker searches. A host
 * passes its own (e.g. a live Mobility Database source); omitted falls back to
 * the bundled catalog so a bare embed still offers routes.
 */
export function RouteSourceProvider({
  source,
  children,
}: {
  source?: RouteSource;
  children: ReactNode;
}) {
  return (
    <RouteSourceContext.Provider value={source ?? DEFAULT_ROUTE_SOURCE}>
      {children}
    </RouteSourceContext.Provider>
  );
}

export function useRouteSource(): RouteSource {
  return useContext(RouteSourceContext);
}
