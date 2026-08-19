import type { Route, RouteType, RouteTypeSettings, TransitMapData } from "./types";

export const ROUTE_TYPES: RouteType[] = ["bus", "tram", "subway", "ferry", "rail", "hsr"];

export const DEFAULT_ROUTE_TYPE: RouteType = "subway";

/** How long a vehicle holds at each intermediate stop, in *simulated* seconds. */
export const DWELL_SECONDS = 30;

/**
 * Seed values for each type: a display label, an average speed (km/h, incl.
 * cruising between stops), and a default headway (min). Speed seeds the
 * editable per-project table; frequency seeds each route when it adopts the type.
 */
export const ROUTE_TYPE_DEFAULTS: Record<
  RouteType,
  { label: string; speedKmh: number; headwayMin: number }
> = {
  bus: { label: "Bus", speedKmh: 20, headwayMin: 10 },
  tram: { label: "Tram", speedKmh: 22, headwayMin: 8 },
  subway: { label: "Subway", speedKmh: 35, headwayMin: 5 },
  ferry: { label: "Ferry", speedKmh: 35, headwayMin: 25 },
  rail: { label: "Regional rail", speedKmh: 60, headwayMin: 20 },
  hsr: { label: "High-speed rail", speedKmh: 200, headwayMin: 45 },
};

export function defaultRouteTypes(): Record<RouteType, RouteTypeSettings> {
  return Object.fromEntries(
    ROUTE_TYPES.map((routeType) => [routeType, { speedKmh: ROUTE_TYPE_DEFAULTS[routeType].speedKmh }])
  ) as Record<RouteType, RouteTypeSettings>;
}

export function defaultHeadwayForRouteType(routeType: RouteType): number {
  return ROUTE_TYPE_DEFAULTS[routeType].headwayMin;
}

/** The speed a route travels at, resolved through its type from the project table. */
export function speedForRoute(data: TransitMapData, route: Route): number {
  const routeType = route.routeType ?? DEFAULT_ROUTE_TYPE;
  const table = data.routeTypes ?? defaultRouteTypes();
  return table[routeType]?.speedKmh ?? ROUTE_TYPE_DEFAULTS[routeType].speedKmh;
}
