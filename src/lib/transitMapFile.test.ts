import { describe, expect, it } from "vitest";
import { normalizeMapData } from "./migrate";
import { parseTransitMapData, serializeTransitMapData } from "./transitMapFile";
import { TransitMapData } from "./types";

// Migrating legacy data mints a fresh pattern uuid, so two independent
// normalize calls never share that id — blank it before comparing the rest.
function blankPatternIds(data: TransitMapData): TransitMapData {
  return {
    ...data,
    routes: data.routes.map((route) => ({
      ...route,
      patterns: route.patterns.map((pattern) => ({ ...pattern, id: "" })),
    })),
  };
}

describe("parseTransitMapData", () => {
  it("returns null for corrupt JSON", () => {
    expect(parseTransitMapData("{not valid json")).toBeNull();
  });

  it("returns null when the version doesn't match", () => {
    expect(parseTransitMapData(JSON.stringify({ version: 99, stops: [], routes: [] }))).toBeNull();
  });

  it("returns null when shape is invalid", () => {
    expect(parseTransitMapData(JSON.stringify({ version: 1, stops: "nope" }))).toBeNull();
  });

  it("parses valid data and migrates it to the current version", () => {
    const data = {
      version: 1 as const,
      title: "My Map",
      stops: [{ id: "p1", name: "Station 1", lng: 0, lat: 0 }],
      routes: [{ id: "l1", name: "Route 1", routeColor: "#fff", stopIds: ["p1"] }],
    };
    expect(blankPatternIds(parseTransitMapData(JSON.stringify(data))!)).toEqual(
      blankPatternIds(normalizeMapData(data as unknown as TransitMapData))
    );
  });

  it("defaults title to an empty string for data saved before titles existed", () => {
    const data = {
      version: 1 as const,
      stops: [{ id: "p1", name: "Station 1", lng: 0, lat: 0 }],
      routes: [],
    };
    expect(parseTransitMapData(JSON.stringify(data))).toEqual(
      normalizeMapData({ ...data, title: "" } as unknown as TransitMapData)
    );
  });
});

describe("serializeTransitMapData", () => {
  it("round-trips through parseTransitMapData", () => {
    const data = {
      version: 3 as const,
      title: "My Map",
      stops: [{ id: "p1", name: "Station 1", lng: 0, lat: 0 }],
      routes: [{ id: "l1", name: "Route 1", routeColor: "#fff", patterns: [{ id: "l1-p", stopIds: ["p1"] }], routeType: "rail" as const, headwayMin: 20 }],
      routeTypes: { bus: { speedKmh: 20 }, tram: { speedKmh: 22 }, subway: { speedKmh: 35 }, ferry: { speedKmh: 35 }, rail: { speedKmh: 60 }, hsr: { speedKmh: 200 } },
    } satisfies TransitMapData;
    expect(parseTransitMapData(serializeTransitMapData(data))).toEqual(data);
  });
});
