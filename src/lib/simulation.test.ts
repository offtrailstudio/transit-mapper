import { describe, expect, it } from "vitest";
import { DWELL_SECONDS } from "./lineKinds";
import { buildRouteSchedule, vehiclePositions } from "./simulation";
import { Route, Stop } from "./types";

// Points laid out east–west along the equator so octilinear routing keeps them
// on one straight horizontal segment (no bend points to reason about).
function pointsAt(lngs: number[]): Map<string, Stop> {
  const map = new Map<string, Stop>();
  lngs.forEach((lng, i) => map.set(`p${i}`, { id: `p${i}`, name: `S${i}`, lng, lat: 0 }));
  return map;
}

function route(stopIds: string[], headwayMin = 10): Route {
  return { id: "l1", name: "L", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds }], headwayMin };
}

describe("buildRouteSchedule", () => {
  it("returns null with fewer than two resolvable stops", () => {
    expect(buildRouteSchedule(route(["p0"]), pointsAt([0]), 30, [])).toBeNull();
  });

  it("cruise time for a two-stop route is distance / speed with no dwell", () => {
    const pts = pointsAt([0, 1]);
    const schedule = buildRouteSchedule(route(["p0", "p1"]), pts, 30, [0])!;
    const expected = schedule.totalMeters / (30 * (1000 / 3600));
    expect(schedule.tripSeconds).toBeCloseTo(expected, 3);
  });

  it("adds one dwell per intermediate stop", () => {
    const pts = pointsAt([0, 1, 2]);
    const twoStop = buildRouteSchedule(route(["p0", "p1"]), pointsAt([0, 2]), 30, [0])!;
    const threeStop = buildRouteSchedule(route(["p0", "p1", "p2"]), pts, 30, [0, 0])!;
    // Same total distance (0→2), so the extra time is exactly the mid-stop dwell.
    expect(threeStop.tripSeconds - twoStop.tripSeconds).toBeCloseTo(DWELL_SECONDS, 3);
  });
});

describe("vehiclePositions", () => {
  const schedule = buildRouteSchedule(route(["p0", "p1"], 10), pointsAt([0, 1]), 30, [0])!;

  it("carries about trip / headway vehicles at once", () => {
    // The count fluctuates by one as vehicles enter and leave the track, so
    // it lands on floor(R) or floor(R)+1 depending on phase — never a fixed number.
    const ratio = schedule.tripSeconds / schedule.headwaySeconds;
    const vehicles = vehiclePositions(schedule, schedule.tripSeconds * 3);
    expect(vehicles.length).toBeGreaterThanOrEqual(Math.floor(ratio));
    expect(vehicles.length).toBeLessThanOrEqual(Math.floor(ratio) + 1);
  });

  it("a fresh departure sits at the origin", () => {
    // At simSeconds = headway a vehicle departs (k=1, elapsed 0) at stop 0.
    const atOrigin = vehiclePositions(schedule, schedule.headwaySeconds).find((v) => v.lng < 0.01);
    expect(atOrigin).toBeDefined();
    expect(atOrigin!.lat).toBeCloseTo(0, 6);
  });

  it("all vehicles travel in the same (stop-order) direction", () => {
    const vehicles = vehiclePositions(schedule, schedule.tripSeconds * 2);
    // East-bound route → every vehicle heads roughly east (bearing ~90).
    for (const v of vehicles) {
      expect(v.bearing).toBeCloseTo(90, 0);
    }
  });

  it("returns nothing when frequency is zero", () => {
    const noService = buildRouteSchedule(route(["p0", "p1"], 0), pointsAt([0, 1]), 30, [0])!;
    expect(vehiclePositions(noService, 100)).toHaveLength(0);
  });
});
