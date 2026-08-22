"use client";

import { createContext, useContext, type ReactNode } from "react";
import { BUNDLED_ROUTE_CATALOG, RouteSource, staticRouteSource } from "../lib/presets";

// Zero-config default: the bundled catalog as a static, searchable source. Built
// once at module load so every embed without a host source shares one index.
const DEFAULT_ROUTE_SOURCE = staticRouteSource(BUNDLED_ROUTE_CATALOG);

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
