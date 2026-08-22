import { describe, expect, it } from "vitest";
import { validateRouteCatalog, ROUTE_CATALOG_SCHEMA_VERSION } from "../lib/presets";
import type { GtfsTables } from "./parse";
import { transformGtfs } from "./transform";

/** A compact synthetic feed: one agency, a rail line (two directions + a
 *  short-turn), a bus, an unsupported "air" route, and a route with no usable
 *  trip. Exercises every branch the transform has to make. */
function fixture(): GtfsTables {
  return {
    agency: [{ agency_id: "MTA", agency_name: "Metro Transit" }],
    stops: [
      { stop_id: "S1", stop_name: "Grand Central", stop_lon: "-73.977", stop_lat: "40.752" },
      { stop_id: "S2", stop_name: "Harlem-125th", stop_lon: "-73.94", stop_lat: "40.805" },
      { stop_id: "S3", stop_name: "White Plains", stop_lon: "-73.76", stop_lat: "41.03" },
      { stop_id: "S4", stop_name: "No Coords", stop_lon: "", stop_lat: "" },
    ],
    routes: [
      {
        route_id: "R1",
        agency_id: "MTA",
        route_long_name: "Harlem Line",
        route_type: "2",
        route_color: "EE0000",
      },
      { route_id: "R2", agency_id: "MTA", route_short_name: "Bx1", route_type: "3" },
      { route_id: "R3", agency_id: "MTA", route_long_name: "Airporter", route_type: "1100" },
      { route_id: "R4", agency_id: "MTA", route_long_name: "Stub", route_type: "2" },
    ],
    trips: [
      { route_id: "R1", trip_id: "T1", trip_headsign: "White Plains" },
      { route_id: "R1", trip_id: "T1r", trip_headsign: "Grand Central" },
      { route_id: "R1", trip_id: "T2", trip_headsign: "Harlem-125th" },
      { route_id: "R2", trip_id: "T3", trip_headsign: "Uptown" },
      { route_id: "R3", trip_id: "T4" },
      { route_id: "R4", trip_id: "T5" },
    ],
    stopTimes: [
      // R1 primary, both directions (should merge into one pattern, count 2).
      { trip_id: "T1", stop_id: "S1", stop_sequence: "1" },
      { trip_id: "T1", stop_id: "S2", stop_sequence: "2" },
      { trip_id: "T1", stop_id: "S3", stop_sequence: "3" },
      { trip_id: "T1r", stop_id: "S3", stop_sequence: "1" },
      { trip_id: "T1r", stop_id: "S2", stop_sequence: "2" },
      { trip_id: "T1r", stop_id: "S1", stop_sequence: "3" },
      // R1 short-turn variant.
      { trip_id: "T2", stop_id: "S1", stop_sequence: "1" },
      { trip_id: "T2", stop_id: "S2", stop_sequence: "2" },
      // R2 bus.
      { trip_id: "T3", stop_id: "S1", stop_sequence: "1" },
      { trip_id: "T3", stop_id: "S2", stop_sequence: "2" },
      // R3 air (route dropped regardless).
      { trip_id: "T4", stop_id: "S1", stop_sequence: "1" },
      { trip_id: "T4", stop_id: "S2", stop_sequence: "2" },
      // R4 has a single-stop trip — not a line.
      { trip_id: "T5", stop_id: "S1", stop_sequence: "1" },
    ],
  };
}

describe("transformGtfs", () => {
  it("keeps only editor-typable routes with a usable pattern", () => {
    const { routes } = transformGtfs(fixture());
    expect(routes.map((r) => r.id).sort()).toEqual(["R1", "R2"]); // R3 (air) + R4 (stub) dropped
  });

  it("maps route_type, name, and color", () => {
    const { routes } = transformGtfs(fixture());
    const r1 = routes.find((r) => r.id === "R1")!;
    expect(r1.name).toBe("Harlem Line");
    expect(r1.routeType).toBe("rail");
    expect(r1.color).toBe("#ee0000");
    expect(routes.find((r) => r.id === "R2")!.name).toBe("Bx1");
  });

  it("merges opposite directions and orders patterns by frequency", () => {
    const r1 = transformGtfs(fixture()).routes.find((r) => r.id === "R1")!;
    // Primary = the full line (2 trips across both directions), then the short-turn.
    expect(r1.patterns).toHaveLength(2);
    expect(r1.patterns[0].stopIds).toEqual(["S1", "S2", "S3"]);
    expect(r1.patterns[0].name).toBe("White Plains");
    expect(r1.patterns[1].stopIds).toEqual(["S1", "S2"]);
  });

  it("prunes the stop table to referenced, valid stops", () => {
    const { stops } = transformGtfs(fixture());
    expect(stops.map((s) => s.id).sort()).toEqual(["S1", "S2", "S3"]); // S4 (no coords) excluded
    expect(stops.find((s) => s.id === "S1")).toMatchObject({ name: "Grand Central", lat: 40.752 });
  });

  it("emits the agency as a group with an inferred default mode", () => {
    const { groups } = transformGtfs(fixture());
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: "MTA", name: "Metro Transit" });
  });

  it("namespaces every id under idPrefix so feeds don't collide", () => {
    const { routes, stops, groups } = transformGtfs(fixture(), { idPrefix: "mnr" });
    expect(stops.every((s) => s.id.startsWith("mnr:"))).toBe(true);
    expect(groups[0].id).toBe("mnr:MTA");
    const r1 = routes.find((r) => r.id === "mnr:R1")!;
    expect(r1.groupId).toBe("mnr:MTA");
    expect(r1.patterns[0].stopIds).toEqual(["mnr:S1", "mnr:S2", "mnr:S3"]);
  });

  it("honors a per-feed route_type override (e.g. promote to hsr)", () => {
    const { routes } = transformGtfs(fixture(), {
      resolveRouteType: (_type, route) => (route.route_long_name === "Harlem Line" ? "hsr" : undefined),
    });
    expect(routes.find((r) => r.id === "R1")!.routeType).toBe("hsr");
    expect(routes.find((r) => r.id === "R2")!.routeType).toBe("bus"); // undefined → standard mapping
  });

  it("caps patterns per route, most-frequent first", () => {
    const r1 = transformGtfs(fixture(), { maxPatternsPerRoute: 1 }).routes.find((r) => r.id === "R1")!;
    expect(r1.patterns).toHaveLength(1);
    expect(r1.patterns[0].stopIds).toEqual(["S1", "S2", "S3"]);
  });

  it("produces a fragment that passes catalog validation", () => {
    const fragment = transformGtfs(fixture(), { idPrefix: "mnr" });
    expect(() =>
      validateRouteCatalog({ schemaVersion: ROUTE_CATALOG_SCHEMA_VERSION, ...fragment })
    ).not.toThrow();
  });
});
