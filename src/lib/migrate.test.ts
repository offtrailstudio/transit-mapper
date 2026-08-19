import { describe, expect, it } from "vitest";
import { defaultRouteTypes, ROUTE_TYPES } from "./lineKinds";
import { normalizeMapData } from "./migrate";
import { TransitMapData } from "./types";

// v1 data as it was actually saved: no version bump, no sim params.
const v1 = {
  version: 1,
  title: "Old map",
  stops: [{ id: "p1", name: "A", lng: 0, lat: 0 }],
  routes: [{ id: "l1", name: "Route 1", routeColor: "#fff", stopIds: ["p1"] }],
} as unknown as TransitMapData;

describe("normalizeMapData", () => {
  it("bumps v1 data to v3", () => {
    expect(normalizeMapData(v1).version).toBe(3);
  });

  it("seeds a full speed table when none exists", () => {
    const result = normalizeMapData(v1);
    expect(result.routeTypes).toEqual(defaultRouteTypes());
    expect(Object.keys(result.routeTypes ?? {})).toHaveLength(ROUTE_TYPES.length);
  });

  it("backfills each route's routeType and frequency", () => {
    const [route] = normalizeMapData(v1).routes;
    expect(route.routeType).toBe("subway");
    expect(route.headwayMin).toBe(5); // subway default
  });

  it("completes a partial speed table without clobbering user values", () => {
    const partial = {
      ...v1,
      routeTypes: { subway: { speedKmh: 99 } },
    } as unknown as TransitMapData;
    const result = normalizeMapData(partial);
    expect(result.routeTypes?.subway.speedKmh).toBe(99);
    expect(result.routeTypes?.ferry.speedKmh).toBe(defaultRouteTypes().ferry.speedKmh);
  });

  it("leaves an explicit frequency untouched", () => {
    const data = {
      ...v1,
      routes: [{ id: "l1", name: "L", routeColor: "#fff", stopIds: ["p1"], routeType: "ferry", headwayMin: 12 }],
    } as unknown as TransitMapData;
    expect(normalizeMapData(data).routes[0].headwayMin).toBe(12);
  });

  it("is idempotent", () => {
    const once = normalizeMapData(v1);
    expect(normalizeMapData(once)).toEqual(once);
  });

  // A map saved before the GTFS rename (#10) used points/lines/color/kind/
  // frequencyMin/lineTypes and has none of the new field names. Reading
  // data.routes directly crashed such users on load ("reading 'map'").
  it("upgrades a pre-rename (points/lines) blob without throwing", () => {
    const preRename = {
      version: 3,
      title: "Legacy map",
      points: [{ id: "p1", name: "A", lng: 1, lat: 2 }],
      lines: [
        {
          id: "l1",
          name: "Old Line",
          color: "#ff0000",
          kind: "rail",
          frequencyMin: 15,
          patterns: [{ id: "pat1", stopIds: ["p1"] }],
        },
      ],
      lineTypes: { subway: { speedKmh: 42 } },
    } as unknown as TransitMapData;

    const result = normalizeMapData(preRename);

    expect(result.stops).toEqual([{ id: "p1", name: "A", lng: 1, lat: 2 }]);
    expect(result.routes).toHaveLength(1);
    const [route] = result.routes;
    expect(route.routeColor).toBe("#ff0000");
    expect(route.routeType).toBe("rail");
    expect(route.headwayMin).toBe(15);
    expect(route.patterns).toEqual([{ id: "pat1", stopIds: ["p1"] }]);
    expect(result.routeTypes?.subway.speedKmh).toBe(42);
  });

  it("degrades to empty arrays when both new and legacy collections are missing", () => {
    const result = normalizeMapData({ version: 3, title: "x" } as unknown as TransitMapData);
    expect(result.stops).toEqual([]);
    expect(result.routes).toEqual([]);
    expect(result.routeTypes).toEqual(defaultRouteTypes());
  });
});
