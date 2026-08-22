import { BUNDLED_ROUTE_CATALOG } from "./index";
import { staticRouteSource, type RouteSource } from "./routeSource";

/**
 * The zero-config default route source: the bundled catalog as a static,
 * searchable source, built once. Kept in its own **non-client** module so it can
 * be lazily imported by the client `RouteSourceContext` without pulling the pure
 * catalog/route-source code into a `"use client"` chunk — which would otherwise
 * poison the server-only `@offtrailstudio/transit-mapper/gtfs` bundle that also
 * depends on {@link staticRouteSource}.
 */
export const DEFAULT_ROUTE_SOURCE: RouteSource = staticRouteSource(BUNDLED_ROUTE_CATALOG);
