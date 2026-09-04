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

describe("label overrides", () => {
  const base = {
    version: 3 as const,
    title: "T",
    stops: [
      { id: "a", name: "Alpha", lng: 1, lat: 2 },
      { id: "b", name: "Beta", lng: 3, lat: 4 },
    ],
    routes: [],
  };

  it("leaves a map that has none without the field at all", () => {
    expect(normalizeMapData(base).labelOverrides).toBeUndefined();
  });

  it("keeps well-formed overrides", () => {
    const data = { ...base, labelOverrides: { a: { angle: 90 }, b: { hidden: true } } };
    expect(normalizeMapData(data).labelOverrides).toEqual({ a: { angle: 90 }, b: { hidden: true } });
  });

  it("drops overrides for stops that no longer exist", () => {
    // A deleted stop's override would otherwise linger in the file forever, and
    // reattach if the id were ever reused.
    const data = { ...base, labelOverrides: { a: { angle: 45 }, ghost: { hidden: true } } };
    expect(normalizeMapData(data).labelOverrides).toEqual({ a: { angle: 45 } });
  });

  it("snaps a stored angle to the eight slots the placer uses", () => {
    const data = { ...base, labelOverrides: { a: { angle: 100 } } };
    expect(normalizeMapData(data).labelOverrides).toEqual({ a: { angle: 90 } });
  });

  it("wraps an out-of-range angle instead of producing a nonsense bearing", () => {
    for (const [given, expected] of [[-45, 315], [405, 45], [720, 0]] as const) {
      const data = { ...base, labelOverrides: { a: { angle: given } } };
      expect(normalizeMapData(data).labelOverrides?.a.angle).toBe(expected);
    }
  });

  it("discards junk rather than trusting whatever was in the file", () => {
    const data = {
      ...base,
      labelOverrides: {
        a: { angle: Number.NaN },
        b: { hidden: "yes" },
      },
    } as unknown as typeof base;
    expect(normalizeMapData(data).labelOverrides).toBeUndefined();
  });

  it("is idempotent, like the rest of the normalizer", () => {
    const data = { ...base, labelOverrides: { a: { angle: 135 }, b: { hidden: true } } };
    const once = normalizeMapData(data);
    expect(normalizeMapData(once)).toEqual(once);
  });
});
