import { RouteType } from "../types";

/** Bump when the catalog shape changes incompatibly; loaders reject unknown versions. */
export const ROUTE_CATALOG_SCHEMA_VERSION = 2;

/**
 * A stop in the catalog's shared table — GTFS `stops.txt`. Referenced by
 * `stopId` from route patterns rather than embedded per route, so a station two
 * routes share is one entry with one identity (as in GTFS), not two coordinates
 * that have to be re-merged by proximity later.
 */
export type CatalogStop = { id: string; name: string; lng: number; lat: number };

/**
 * One ordered stop sequence a route runs — GTFS trip pattern. Mirrors
 * {@link import("../types").StopPattern}: a route owns at least one; more than
 * one models branches, short-turns, or direction variants. The first is primary
 * (what the picker adds).
 */
export type CatalogPattern = {
  id: string;
  /** Optional human label for the variant (GTFS `trip_headsign`-ish), e.g. "via Airport". */
  name?: string;
  /** Ordered `CatalogStop` ids along this pattern. */
  stopIds: string[];
};

/**
 * A branded transit route — GTFS `route`. `routeType` maps to GTFS `route_type`,
 * `color` to `route_color`. Its ordered stop sequences live in `patterns` (never
 * inline), each referencing the catalog's shared `stops` table by id.
 */
export type CatalogRoute = {
  id: string;
  name: string;
  color?: string;
  /** GTFS `route_type`. Omitted presets adopt the group/editor default. */
  routeType?: RouteType;
  description?: string;
  groupId?: string;
  /** Stop sequences (GTFS route ⟶ trip patterns). Always ≥ 1; `patterns[0]` is primary. */
  patterns: CatalogPattern[];
};

export type RouteNetwork = {
  id: string;
  name: string;
  description?: string;
  /**
   * Transit mode every route in this group adopts unless it sets its own
   * `routeType`. Lets a whole network be typed once instead of per route.
   */
  defaultRouteType?: RouteType;
};
