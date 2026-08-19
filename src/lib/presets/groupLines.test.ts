import { describe, expect, it } from "vitest";
import { groupPresetRoutes } from "./groupLines";
import { PresetGroup, PresetRoute } from "./types";

const GROUPS: PresetGroup[] = [
  { id: "amtrak", name: "Amtrak" },
  { id: "nyc-subway", name: "NYC Subway" },
];

function route(id: string, groupId?: string): PresetRoute {
  return { id, name: id, groupId, stops: [] };
}

describe("groupPresetRoutes", () => {
  it("buckets routes under their group, in registry order", () => {
    const routes = [route("a", "amtrak"), route("b", "nyc-subway"), route("c", "amtrak")];
    const result = groupPresetRoutes(routes, GROUPS);

    expect(result.map((r) => r.group?.id)).toEqual(["amtrak", "nyc-subway"]);
    expect(result[0].routes.map((l) => l.id)).toEqual(["a", "c"]);
    expect(result[1].routes.map((l) => l.id)).toEqual(["b"]);
  });

  it("buckets routes with no groupId under group: null", () => {
    const routes = [route("a", "amtrak"), route("standalone")];
    const result = groupPresetRoutes(routes, GROUPS);

    const ungrouped = result.find((r) => r.group === null);
    expect(ungrouped?.routes.map((l) => l.id)).toEqual(["standalone"]);
  });

  it("omits groups with no routes", () => {
    const routes = [route("a", "amtrak")];
    const result = groupPresetRoutes(routes, GROUPS);

    expect(result).toHaveLength(1);
    expect(result[0].group?.id).toBe("amtrak");
  });

  it("omits the ungrouped bucket entirely when every route has a group", () => {
    const routes = [route("a", "amtrak")];
    const result = groupPresetRoutes(routes, GROUPS);

    expect(result.some((r) => r.group === null)).toBe(false);
  });
});
