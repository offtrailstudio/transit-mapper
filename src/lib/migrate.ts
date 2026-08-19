import {
  DEFAULT_ROUTE_TYPE,
  defaultHeadwayForRouteType,
  defaultRouteTypes,
} from "./lineKinds";
import { RouteType, RouteTypeSettings, Stop, StopPattern, TransitMapData } from "./types";

/**
 * The shapes older stored maps could have. Before the GTFS rename (#10) the
 * model used `points`/`lines` with `color`/`kind`/`frequencyMin`/`lineTypes`;
 * before #9 a route carried a bare `stopIds` instead of `patterns`. A blob can
 * predate any of these, so we read from both the old and new field names.
 */
type LegacyMapData = TransitMapData & {
  points?: Stop[];
  lines?: LegacyRoute[];
  lineTypes?: Record<string, RouteTypeSettings>;
};

type LegacyRoute = {
  id: string;
  name: string;
  routeColor?: string;
  color?: string;
  routeType?: RouteType;
  kind?: RouteType;
  headwayMin?: number;
  frequencyMin?: number;
  hidden?: boolean;
  patterns?: StopPattern[];
  stopIds?: string[];
};

/**
 * Brings a parsed map up to the current shape so nothing downstream ever sees a
 * route without a routeType/frequency/pattern or a project without a speed table.
 * Idempotent: current data with everything filled passes through unchanged in
 * value. Tolerates and upgrades every earlier shape.
 *
 * - v2 added the simulation params (`routeType`, `headwayMin`, `routeTypes`).
 * - #9 moved each route's `stopIds` into a `patterns` array (GTFS route ⟶ trip
 *   patterns), so a route can carry more than one stop sequence.
 * - #10 renamed the model to GTFS vocabulary: `points`→`stops`, `lines`→`routes`,
 *   `color`→`routeColor`, `kind`→`routeType`, `frequencyMin`→`headwayMin`,
 *   `lineTypes`→`routeTypes`. A map saved before this has none of the new field
 *   names, so reading `data.routes` directly would throw on `.map`.
 *
 * Each is backfilled the same way `title` was when it was introduced, rather
 * than failing older data.
 */
export function normalizeMapData(data: TransitMapData): TransitMapData {
  const legacy = data as LegacyMapData;
  const seededTypes = defaultRouteTypes();
  const routeTypes = { ...seededTypes, ...(legacy.routeTypes ?? legacy.lineTypes ?? {}) };

  const stops: Stop[] = Array.isArray(legacy.stops)
    ? legacy.stops
    : Array.isArray(legacy.points)
      ? legacy.points
      : [];

  const legacyRoutes: LegacyRoute[] = Array.isArray(legacy.routes)
    ? (legacy.routes as LegacyRoute[])
    : Array.isArray(legacy.lines)
      ? legacy.lines
      : [];

  const routes = legacyRoutes.map((route) => {
    const routeType: RouteType = route.routeType ?? route.kind ?? DEFAULT_ROUTE_TYPE;
    // Keep existing patterns; otherwise wrap the legacy `stopIds` (or nothing)
    // in a single primary pattern. Never emit a route without a pattern.
    const patterns: StopPattern[] =
      Array.isArray(route.patterns) && route.patterns.length > 0
        ? route.patterns
        : [{ id: crypto.randomUUID(), stopIds: Array.isArray(route.stopIds) ? route.stopIds : [] }];
    return {
      id: route.id,
      name: route.name,
      routeColor: route.routeColor ?? route.color ?? "#888888",
      routeType,
      headwayMin:
        typeof route.headwayMin === "number"
          ? route.headwayMin
          : typeof route.frequencyMin === "number"
            ? route.frequencyMin
            : defaultHeadwayForRouteType(routeType),
      ...(route.hidden ? { hidden: true } : {}),
      patterns,
    };
  });

  return { version: 3, title: data.title ?? "", stops, routes, routeTypes };
}
