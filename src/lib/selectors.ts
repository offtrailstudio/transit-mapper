import { routeStopIds } from "./lines";
import { Stop, TransitMapData } from "./types";

/** Stations that don't appear in any pattern of any route. */
export function getUnassignedStops(data: TransitMapData): Stop[] {
  const assignedIds = new Set(data.routes.flatMap(routeStopIds));
  return data.stops.filter((stop) => !assignedIds.has(stop.id));
}

/**
 * Stations to draw given route visibility: a stop is hidden only when every route
 * that serves it is hidden. Stops served by at least one visible route — and
 * unassigned stops, which belong to no route — stay on the map.
 */
export function getVisibleStops(data: TransitMapData): Stop[] {
  const servedByVisible = new Set(
    data.routes.filter((route) => !route.hidden).flatMap(routeStopIds),
  );
  const servedByHidden = new Set(
    data.routes.filter((route) => route.hidden).flatMap(routeStopIds),
  );
  return data.stops.filter(
    (stop) => servedByVisible.has(stop.id) || !servedByHidden.has(stop.id),
  );
}
