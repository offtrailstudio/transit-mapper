import { describe, expect, it } from "vitest";
import { normalizeMapData } from "./migrate";
import { parseStoredMap } from "./storage";
import { EMPTY_MAP_DATA, TransitMapData } from "./types";

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

describe("parseStoredMap", () => {
  it("returns empty map data when there is nothing stored", () => {
    expect(parseStoredMap(null)).toEqual(EMPTY_MAP_DATA);
  });

  it("returns empty map data for corrupt JSON", () => {
    expect(parseStoredMap("{not valid json")).toEqual(EMPTY_MAP_DATA);
  });

  it("returns empty map data when the version doesn't match", () => {
    expect(parseStoredMap(JSON.stringify({ version: 99, stops: [], routes: [] }))).toEqual(
      EMPTY_MAP_DATA
    );
  });

  it("returns empty map data when shape is invalid", () => {
    expect(parseStoredMap(JSON.stringify({ version: 1, stops: "nope" }))).toEqual(
      EMPTY_MAP_DATA
    );
  });

  it("parses valid data and migrates it to the current version", () => {
    const data = {
      version: 1 as const,
      title: "My Map",
      stops: [{ id: "p1", name: "Station 1", lng: 0, lat: 0 }],
      routes: [{ id: "l1", name: "Route 1", routeColor: "#fff", stopIds: ["p1"] }],
    };
    expect(blankPatternIds(parseStoredMap(JSON.stringify(data)))).toEqual(
      blankPatternIds(normalizeMapData(data as unknown as TransitMapData))
    );
  });

  it("defaults title to an empty string for data saved before titles existed", () => {
    const data = {
      version: 1 as const,
      stops: [{ id: "p1", name: "Station 1", lng: 0, lat: 0 }],
      routes: [],
    };
    expect(parseStoredMap(JSON.stringify(data))).toEqual(
      normalizeMapData({ ...data, title: "" } as unknown as TransitMapData)
    );
  });
});
