import { DEFAULT_ROUTE_TYPE } from "../lineKinds";
import { RouteType } from "../types";
import { CatalogRoute, RouteNetwork } from "./types";

export type RouteNetworkGroup<T = CatalogRoute> = { group: RouteNetwork | null; routes: T[] };

/**
 * The transit mode a preset route resolves to: its own `routeType` wins, then
 * its group's `defaultRouteType`, then the editor-wide default. This is the
 * mode a route adopts when added to a map. Structural in `route` so it serves
 * both the normalized v2 route and the flat legacy authoring shape.
 */
export function resolveRouteMode(
  route: { routeType?: RouteType },
  group: RouteNetwork | null
): RouteType {
  return route.routeType ?? group?.defaultRouteType ?? DEFAULT_ROUTE_TYPE;
}

export function groupRoutesByNetwork<T extends { groupId?: string }>(
  routes: T[],
  groups: RouteNetwork[]
): RouteNetworkGroup<T>[] {
  const byGroupId = new Map<string, T[]>();
  const ungrouped: T[] = [];

  for (const route of routes) {
    if (route.groupId) {
      const bucket = byGroupId.get(route.groupId) ?? [];
      bucket.push(route);
      byGroupId.set(route.groupId, bucket);
    } else {
      ungrouped.push(route);
    }
  }

  const result: RouteNetworkGroup<T>[] = groups
    .filter((g) => byGroupId.has(g.id))
    .map((g) => ({ group: g, routes: byGroupId.get(g.id)! }));

  if (ungrouped.length > 0) {
    result.push({ group: null, routes: ungrouped });
  }
  return result;
}
