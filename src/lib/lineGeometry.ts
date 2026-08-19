import { primaryStopIds } from "./lines";
import { octilinearPath } from "./octilinear";
import { clusterStations } from "./stationClusters";
import { Stop, TransitMapData } from "./types";

/**
 * How an edge between two consecutive stops is turned into a path. Defaults to
 * geographic octilinear routing in lng/lat; the schematic export swaps in a
 * router that works in its own already-planar coordinate space.
 */
export type EdgeRouter = (a: Stop, b: Stop) => [number, number][];

const geographicRouter: EdgeRouter = (a, b) => octilinearPath([a.lng, a.lat], [b.lng, b.lat]);

export type RouteRun = {
  routeId: string;
  color: string;
  coordinates: [number, number][];
  /** Pixel offset for Mapbox's route-offset paint property — pixels (not
   * real-world distance) so the visual gap between parallel routes stays
   * consistent across zoom levels. */
  offsetPixels: number;
};

export const LINE_WIDTH_PX = 5;
export const OFFSET_STEP_PX = 4;

function edgeKey(stopIdA: string, stopIdB: string): string {
  return [stopIdA, stopIdB].sort().join("::");
}

function offsetForIndex(index: number): number {
  if (index <= 0) return 0;
  const side = index % 2 === 1 ? 1 : -1;
  const magnitude = Math.ceil(index / 2);
  return side * magnitude * OFFSET_STEP_PX;
}

/**
 * The painted pixel offset for each route's every stop-to-stop edge, keyed by
 * route id — `offsets[i]` is the offset for the edge from stop `i` to stop
 * `i + 1`. This is the single source of truth for where a route draws relative
 * to others sharing a trunk; both `buildRouteRuns` (rendering) and the
 * simulation (keeping moving vehicles on the same drawn track) read it.
 */
export function routeEdgeOffsets(data: TransitMapData): Map<string, number[]> {
  // Two routes sharing a real-world station (e.g. added from separate
  // presets) end up with distinct Stop records at nearly the same
  // coordinates rather than one shared Stop — cluster those together so
  // the offset logic below still recognizes the segment as shared instead
  // of drawing the routes stacked exactly on top of each other.
  const clusterOf = clusterStations(data.stops);
  const clusterId = (stopId: string) => clusterOf.get(stopId) ?? stopId;

  // Which routes (in a stable order) traverse each physical stop-to-stop
  // segment, regardless of which direction each route lists its stops in —
  // that order determines each route's offset index on that segment.
  const edgeRouteOrder = new Map<string, string[]>();
  // The "from" cluster of the FIRST route to traverse each segment. Offset
  // signs are chosen relative to this direction (see below) rather than to
  // the sorted-id direction, so a route keeps the same side through a turn.
  const edgeReferenceFrom = new Map<string, string>();
  for (const route of data.routes) {
    const stopIds = primaryStopIds(route);
    for (let i = 0; i < stopIds.length - 1; i++) {
      const clusterA = clusterId(stopIds[i]);
      const clusterB = clusterId(stopIds[i + 1]);
      const key = edgeKey(clusterA, clusterB);
      if (!edgeRouteOrder.has(key)) edgeReferenceFrom.set(key, clusterA);
      const order = edgeRouteOrder.get(key) ?? [];
      if (!order.includes(route.id)) {
        order.push(route.id);
        edgeRouteOrder.set(key, order);
      }
    }
  }

  const offsetsByRoute = new Map<string, number[]>();
  for (const route of data.routes) {
    const stopIds = primaryStopIds(route);
    const offsets: number[] = [];
    for (let i = 0; i < stopIds.length - 1; i++) {
      const clusterA = clusterId(stopIds[i]);
      const clusterB = clusterId(stopIds[i + 1]);
      const key = edgeKey(clusterA, clusterB);
      const offsetIndex = (edgeRouteOrder.get(key) ?? []).indexOf(route.id);
      // The offset's sign is chosen relative to the direction the FIRST route
      // to use this segment traveled it, and flipped when this route traverses
      // the segment the opposite way. Using that reference direction (a real
      // travel direction) rather than the sorted-id direction keeps two routes
      // running together on consistent sides through a turn — the sorted-id
      // reference could invert from one segment to the next and make parallel
      // routes swap places at a bend — while still placing opposite-direction
      // routes on opposite sides so they don't draw on top of each other.
      const isReversed = edgeReferenceFrom.get(key) !== clusterA;
      offsets.push(isReversed ? -offsetForIndex(offsetIndex) : offsetForIndex(offsetIndex));
    }
    offsetsByRoute.set(route.id, offsets);
  }
  return offsetsByRoute;
}

/**
 * Builds each route's renderable path as one or more "runs": consecutive
 * stops connected by octilinear (45/90-degree) bent segments instead of a
 * direct geographic route. A run breaks wherever the route's offset changes —
 * i.e. wherever it starts or stops sharing a physical stop-to-stop segment
 * with other routes — since Mapbox's route-offset paint property is constant
 * per feature. Shared segments get routes offset sideways so they draw side
 * by side, the way Vignelli-style schematic maps show shared trunk segments,
 * instead of stacking exactly on top of each other.
 *
 * `routeEdge` controls how a stop-to-stop edge becomes a path; it defaults to
 * geographic octilinear routing, and the schematic export passes a planar
 * router over its own pre-computed positions.
 */
export function buildRouteRuns(data: TransitMapData, routeEdge: EdgeRouter = geographicRouter): RouteRun[] {
  const stopsById = new Map(data.stops.map((stop) => [stop.id, stop]));
  const offsetsByRoute = routeEdgeOffsets(data);
  const runs: RouteRun[] = [];

  for (const route of data.routes) {
    const stopIds = primaryStopIds(route);
    const offsets = offsetsByRoute.get(route.id) ?? [];
    let currentRun: RouteRun | null = null;

    for (let i = 0; i < stopIds.length - 1; i++) {
      const stopA = stopsById.get(stopIds[i]);
      const stopB = stopsById.get(stopIds[i + 1]);
      if (!stopA || !stopB) continue;

      const offsetPixels = offsets[i];
      const edgePath = routeEdge(stopA, stopB);

      if (currentRun && currentRun.offsetPixels === offsetPixels) {
        currentRun.coordinates.push(...edgePath.slice(1));
      } else {
        if (currentRun) runs.push(currentRun);
        currentRun = { routeId: route.id, color: route.routeColor, coordinates: [...edgePath], offsetPixels };
      }
    }

    if (currentRun) runs.push(currentRun);
  }

  return runs.filter((run) => run.coordinates.length >= 2);
}
