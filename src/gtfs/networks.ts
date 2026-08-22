import type { GtfsRow } from "./parse";
import type { RouteType } from "../lib/types";

/**
 * One curated network to ingest from the Mobility Database. A feed is resolved
 * either by a pinned `feedId` (exact, reproducible — preferred once known) or by
 * a `provider` name search (convenient before you know the id). `idPrefix`
 * namespaces every id the feed contributes so agencies can't collide.
 */
export type NetworkSpec = {
  idPrefix: string;
  /** Exact Mobility Database feed id, e.g. "mdb-10". Wins over `provider`. */
  feedId?: string;
  /** Provider-name search used when no `feedId` is pinned. */
  provider?: string;
  /** Per-feed GTFS `route_type` override (see {@link import("./transform").TransformOptions}). */
  resolveRouteType?: (gtfsRouteType: number, route: GtfsRow) => RouteType | null | undefined;
};

const routeName = (route: GtfsRow): string => route.route_long_name || route.route_short_name || "";

/**
 * The networks the bundled catalog ships today, now sourced from GTFS. Feeds are
 * resolved by provider first; pin `feedId` (logged on each run) once confirmed so
 * builds are reproducible. High-speed rail isn't expressible in basic GTFS
 * `route_type`, so Amtrak promotes Acela by name.
 */
export const NETWORKS: NetworkSpec[] = [
  {
    idPrefix: "amtrak",
    provider: "Amtrak",
    resolveRouteType: (_type, route) => (/\bacela\b/i.test(routeName(route)) ? "hsr" : undefined),
  },
  { idPrefix: "mta-mnr", provider: "Metro-North" },
  { idPrefix: "ucat", provider: "Ulster County Area Transit" },
  { idPrefix: "dutchess", provider: "Dutchess County" },
];
