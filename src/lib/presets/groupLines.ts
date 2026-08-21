import { DEFAULT_ROUTE_TYPE } from "../lineKinds";
import { RouteType } from "../types";
import { PresetRoute, PresetGroup } from "./types";

export type PresetRouteGroup = { group: PresetGroup | null; routes: PresetRoute[] };

/**
 * The transit mode a preset route resolves to: its own `routeType` wins, then
 * its group's `defaultRouteType`, then the editor-wide default. This is the
 * mode a route adopts when added to a map.
 */
export function resolvePresetRouteType(route: PresetRoute, group: PresetGroup | null): RouteType {
  return route.routeType ?? group?.defaultRouteType ?? DEFAULT_ROUTE_TYPE;
}

export function groupPresetRoutes(routes: PresetRoute[], groups: PresetGroup[]): PresetRouteGroup[] {
  const byGroupId = new Map<string, PresetRoute[]>();
  const ungrouped: PresetRoute[] = [];

  for (const route of routes) {
    if (route.groupId) {
      const bucket = byGroupId.get(route.groupId) ?? [];
      bucket.push(route);
      byGroupId.set(route.groupId, bucket);
    } else {
      ungrouped.push(route);
    }
  }

  const result: PresetRouteGroup[] = groups
    .filter((g) => byGroupId.has(g.id))
    .map((g) => ({ group: g, routes: byGroupId.get(g.id)! }));

  if (ungrouped.length > 0) {
    result.push({ group: null, routes: ungrouped });
  }
  return result;
}
