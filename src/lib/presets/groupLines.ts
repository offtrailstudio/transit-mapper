import { PresetRoute, PresetGroup } from "./types";

export type PresetRouteGroup = { group: PresetGroup | null; routes: PresetRoute[] };

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
