import { describe, expect, it } from "vitest";
import { computeSchematicPositions } from "./schematicLayout";
import { Route, Stop, TransitMapData } from "./types";

function data(stops: Stop[], routes: Route[]): TransitMapData {
  return { version: 3, title: "", stops, routes };
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// A chain whose real spacing is wildly irregular — some stops close together,
// some far apart (but all beyond the cluster-merge threshold). The schematic
// should even this out, which is what unclutters a bunched downtown.
function bunchedRoute(n: number): TransitMapData {
  const stops: Stop[] = [];
  const stopIds: string[] = [];
  let lng = -71.06;
  const lat = 42.355;
  for (let i = 0; i < n; i++) {
    stops.push({ id: `s${i}`, name: `Stop ${i}`, lng, lat: lat + i * 0.0018 });
    stopIds.push(`s${i}`);
    // Alternating short/long gaps, all comfortably above the ~100m merge distance.
    lng += i % 2 === 0 ? 0.0025 : 0.012;
  }
  return data(stops, [{ id: "l", name: "L", routeColor: "#f00", patterns: [{ id: "l-p", stopIds }] }]);
}

describe("computeSchematicPositions", () => {
  it("returns a position for every stop", () => {
    const positions = computeSchematicPositions(bunchedRoute(5));
    for (let i = 0; i < 5; i++) {
      expect(positions.has(`s${i}`)).toBe(true);
    }
  });

  it("handles empty data", () => {
    expect(computeSchematicPositions(data([], [])).size).toBe(0);
  });

  it("spreads a geographically-bunched route to roughly uniform spacing", () => {
    const positions = computeSchematicPositions(bunchedRoute(8));
    const gaps: number[] = [];
    for (let i = 0; i < 7; i++) {
      gaps.push(dist(positions.get(`s${i}`)!, positions.get(`s${i + 1}`)!));
    }
    // Every gap is comparable — no more piling three stops into one spot.
    const min = Math.min(...gaps);
    const max = Math.max(...gaps);
    expect(min).toBeGreaterThan(0.5);
    expect(max / min).toBeLessThan(1.6);
  });

  it("pulls edges toward octilinear angles", () => {
    const positions = computeSchematicPositions(bunchedRoute(8));
    const step = Math.PI / 4;
    let totalDeviation = 0;
    for (let i = 0; i < 7; i++) {
      const a = positions.get(`s${i}`)!;
      const b = positions.get(`s${i + 1}`)!;
      const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const deviation = Math.abs(angle - Math.round(angle / step) * step);
      totalDeviation += deviation;
    }
    // Comfortably under an eighth of the 45° step, on average.
    expect(totalDeviation / 7).toBeLessThan(0.1);
  });

  it("gives clustered (shared) stations a single position", () => {
    // Two routes meeting at one real station, added as two coincident stops.
    const stops: Stop[] = [
      { id: "a", name: "A", lng: -71.07, lat: 42.35 },
      { id: "hub1", name: "Hub", lng: -71.06, lat: 42.355 },
      { id: "b", name: "B", lng: -71.05, lat: 42.36 },
      { id: "hub2", name: "Hub", lng: -71.06, lat: 42.355 },
      { id: "c", name: "C", lng: -71.06, lat: 42.37 },
    ];
    const routes: Route[] = [
      { id: "l1", name: "L1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a", "hub1", "b"] }] },
      { id: "l2", name: "L2", routeColor: "#00f", patterns: [{ id: "l2-p", stopIds: ["c", "hub2"] }] },
    ];
    const positions = computeSchematicPositions(data(stops, routes));
    expect(positions.get("hub1")).toEqual(positions.get("hub2"));
  });

  it("is deterministic", () => {
    const first = computeSchematicPositions(bunchedRoute(6));
    const second = computeSchematicPositions(bunchedRoute(6));
    for (const [id, pos] of first) {
      expect(second.get(id)).toEqual(pos);
    }
  });
});
