import { describe, expect, it } from "vitest";
import { groupRoutesByNetwork, resolveRouteMode } from "./groupLines";
import { RouteNetwork, CatalogRoute } from "./types";

const GROUPS: RouteNetwork[] = [
  { id: "amtrak", name: "Amtrak" },
  { id: "nyc-subway", name: "NYC Subway" },
];

function route(id: string, groupId?: string): CatalogRoute {
  return { id, name: id, groupId, patterns: [] };
}

describe("groupRoutesByNetwork", () => {
  it("buckets routes under their group, in registry order", () => {
    const routes = [route("a", "amtrak"), route("b", "nyc-subway"), route("c", "amtrak")];
    const result = groupRoutesByNetwork(routes, GROUPS);

    expect(result.map((r) => r.group?.id)).toEqual(["amtrak", "nyc-subway"]);
    expect(result[0].routes.map((l) => l.id)).toEqual(["a", "c"]);
    expect(result[1].routes.map((l) => l.id)).toEqual(["b"]);
  });

  it("buckets routes with no groupId under group: null", () => {
    const routes = [route("a", "amtrak"), route("standalone")];
    const result = groupRoutesByNetwork(routes, GROUPS);

    const ungrouped = result.find((r) => r.group === null);
    expect(ungrouped?.routes.map((l) => l.id)).toEqual(["standalone"]);
  });

  it("omits groups with no routes", () => {
    const routes = [route("a", "amtrak")];
    const result = groupRoutesByNetwork(routes, GROUPS);

    expect(result).toHaveLength(1);
    expect(result[0].group?.id).toBe("amtrak");
  });

  it("omits the ungrouped bucket entirely when every route has a group", () => {
    const routes = [route("a", "amtrak")];
    const result = groupRoutesByNetwork(routes, GROUPS);

    expect(result.some((r) => r.group === null)).toBe(false);
  });
});

describe("resolveRouteMode", () => {
  const busGroup: RouteNetwork = { id: "g", name: "G", defaultRouteType: "bus" };

  it("uses the route's own routeType when set", () => {
    const r: CatalogRoute = { id: "a", name: "a", routeType: "hsr", patterns: [] };
    expect(resolveRouteMode(r, busGroup)).toBe("hsr");
  });

  it("falls back to the group's defaultRouteType", () => {
    expect(resolveRouteMode(route("a", "g"), busGroup)).toBe("bus");
  });

  it("falls back to the editor default when neither is set", () => {
    expect(resolveRouteMode(route("a"), null)).toBe("subway");
    expect(resolveRouteMode(route("a"), { id: "g", name: "G" })).toBe("subway");
  });
});
