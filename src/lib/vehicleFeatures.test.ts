import { describe, expect, it } from "vitest";
import { buildRouteSchedule } from "./simulation";
import { Route, Stop } from "./types";
import { buildVehicleFeatures } from "./vehicleFeatures";

function pointsAt(lngs: number[]): Map<string, Stop> {
  const map = new Map<string, Stop>();
  lngs.forEach((lng, i) => map.set(`p${i}`, { id: `p${i}`, name: `S${i}`, lng, lat: 0 }));
  return map;
}

const route: Route = { id: "l1", name: "L", routeColor: "#ff0000", patterns: [{ id: "l1-p", stopIds: ["p0", "p1"] }], headwayMin: 10 };
const schedule = buildRouteSchedule(route, pointsAt([0, 1]), 30, [0])!;

describe("buildVehicleFeatures", () => {
  it("emits a stop feature per active vehicle carrying its route color", () => {
    const fc = buildVehicleFeatures([schedule], schedule.tripSeconds / 2, 11);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.length).toBeGreaterThan(0);
    for (const f of fc.features) {
      expect(f.geometry.type).toBe("Point");
      expect(f.properties?.color).toBe("#ff0000");
    }
  });

  it("centres vehicles on the route when it has no painted offset", () => {
    // The east–west equator route has offsetPx 0, so every vehicle rides the
    // centreline (latitude 0) rather than being split to either side.
    const fc = buildVehicleFeatures([schedule], schedule.tripSeconds / 2, 11);
    expect(fc.features.length).toBeGreaterThan(0);
    for (const f of fc.features) {
      expect(f.geometry.coordinates[1]).toBeCloseTo(0, 9);
    }
  });

  it("is empty when there are no schedules", () => {
    expect(buildVehicleFeatures([], 100, 11).features).toHaveLength(0);
  });
});
