import { defaultRouteTypes } from "./lineKinds";

export type Stop = {
  id: string;
  name: string;
  lng: number;
  lat: number;
};

/** The transit modes a route can be, used to look up its travel speed. */
export type RouteType = "bus" | "tram" | "subway" | "ferry" | "rail" | "hsr";

/** Per-type simulation settings, edited once per project and shared by every route of that routeType. */
export type RouteTypeSettings = {
  /** Average travel speed in km/h, including cruising between stops. */
  speedKmh: number;
};

/**
 * One ordered stop sequence a route runs — the GTFS "trip pattern" (a stop_times
 * ordering) concept. A route (GTFS route) owns at least one; more than one models
 * branches, short-turns, or direction variants. Editing targets the first.
 */
export type StopPattern = {
  id: string;
  /** Optional human label for the variant (GTFS trip_headsign-ish), e.g. "via Airport". */
  name?: string;
  /** Ordered stop IDs — the sequence of stops along this pattern. */
  stopIds: string[];
};

/**
 * A branded transit route — GTFS `route`. `routeType` maps to GTFS `route_type`,
 * `routeColor` to `route_color`, `headwayMin` to a `frequencies.txt` headway. The
 * ordered stop sequences live in `patterns` (GTFS trips/patterns), never on the
 * route directly — resolve them via `primaryStopIds`/`routeStopIds` in `lines.ts`.
 */
export type Route = {
  id: string;
  name: string;
  routeColor: string;
  /** Which transit type this route is; its speed lives in `TransitMapData.routeTypes`, not here. */
  routeType?: RouteType;
  /** Minutes between departures. Per-route (the density dial), seeded from the type on adoption. */
  headwayMin?: number;
  /** When true, the route is temporarily hidden from the live map (and simulation). Absent = visible. */
  hidden?: boolean;
  /** The route's stop sequences (GTFS route ⟶ trip patterns). Always ≥ 1 after `normalizeMapData`. */
  patterns: StopPattern[];
};

export type TransitMapData = {
  version: 3;
  title: string;
  stops: Stop[];
  routes: Route[];
  /** Editable speed table shared across the project. `normalizeMapData` guarantees it's present. */
  routeTypes?: Record<RouteType, RouteTypeSettings>;
};

export const EMPTY_MAP_DATA: TransitMapData = {
  version: 3,
  title: "",
  stops: [],
  routes: [],
  routeTypes: defaultRouteTypes(),
};
