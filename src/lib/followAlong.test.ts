import { describe, expect, it } from "vitest";
import {
  buildFollowTimeline,
  FOLLOW_DWELL_REAL_SECONDS,
  followDwellSeconds,
  sampleFollow,
} from "./followAlong";
import { buildRouteSchedule } from "./simulation";
import { Route, Stop } from "./types";

// Points laid out east–west along the equator so octilinear routing keeps them
// on one straight horizontal segment (no bend points to reason about).
function pointsAt(lngs: number[]): Map<string, Stop> {
  const map = new Map<string, Stop>();
  lngs.forEach((lng, i) => map.set(`p${i}`, { id: `p${i}`, name: `S${i}`, lng, lat: 0 }));
  return map;
}

function route(stopIds: string[]): Route {
  return { id: "l1", name: "L", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds }] };
}

function scheduleFor(stopIds: string[], lngs: number[], speedKmh = 36) {
  return buildRouteSchedule(route(stopIds), pointsAt(lngs), speedKmh, stopIds.map(() => 0))!;
}

describe("followDwellSeconds", () => {
  it("holds for the same wall-clock time at every playback speed", () => {
    // The whole point: a dwell fixed in *simulated* seconds shrinks as playback
    // speeds up, and at 60× the stop name flashed past in ~330ms.
    for (const multiplier of [1, 2, 5, 10, 60]) {
      const simSeconds = followDwellSeconds(multiplier);
      expect(simSeconds / multiplier).toBeCloseTo(FOLLOW_DWELL_REAL_SECONDS, 6);
    }
  });

  it("never collapses to nothing on a zero or negative speed", () => {
    expect(followDwellSeconds(0)).toBe(FOLLOW_DWELL_REAL_SECONDS);
    expect(followDwellSeconds(-5)).toBe(FOLLOW_DWELL_REAL_SECONDS);
  });
});

describe("buildFollowTimeline", () => {
  it("holds at every stop, origin and terminus included", () => {
    const timeline = buildFollowTimeline(scheduleFor(["p0", "p1", "p2"], [0, 1, 2]))!;

    expect(timeline.stopIds).toEqual(["p0", "p1", "p2"]);
    // Departing the origin is a dwell, not t = 0 — the name needs a beat on screen.
    expect(timeline.arrivals[0]).toBe(0);
    expect(timeline.departures[0]).toBe(FOLLOW_DWELL_REAL_SECONDS);
    // The run ends on the terminus dwell rather than the moment of arrival.
    expect(timeline.runSeconds).toBeCloseTo(timeline.arrivals[2] + FOLLOW_DWELL_REAL_SECONDS, 6);
  });

  it("spends distance / speed between consecutive stops", () => {
    const schedule = scheduleFor(["p0", "p1"], [0, 1]);
    const timeline = buildFollowTimeline(schedule)!;
    const hop = timeline.arrivals[1] - timeline.departures[0];

    expect(hop).toBeCloseTo(schedule.totalMeters / schedule.speedMps, 3);
  });

  it("names only the stops the geometry reached", () => {
    // p2 is missing from the stop table, so the schedule stops short at p1 — the
    // run must not announce a stop its vehicle never travels to.
    const schedule = buildRouteSchedule(
      route(["p0", "p1", "p2", "p3"]),
      pointsAt([0, 1]),
      36,
      [0, 0, 0]
    )!;
    const timeline = buildFollowTimeline(schedule)!;

    expect(timeline.stopIds).toEqual(["p0", "p1"]);
  });
});

describe("sampleFollow", () => {
  const schedule = scheduleFor(["p0", "p1", "p2"], [0, 1, 2]);
  const timeline = buildFollowTimeline(schedule)!;

  it("holds at the origin before departing", () => {
    const at = sampleFollow(schedule, timeline, FOLLOW_DWELL_REAL_SECONDS / 2);

    expect(at).toMatchObject({ stopIndex: 0, dwelling: true, run: 0 });
    expect(at.vehicle.lng).toBeCloseTo(0, 6);
  });

  it("reports the stop it is approaching while moving", () => {
    const midHop = (timeline.departures[0] + timeline.arrivals[1]) / 2;
    const at = sampleFollow(schedule, timeline, midHop);

    expect(at).toMatchObject({ stopIndex: 1, dwelling: false });
    // Halfway through the hop, halfway between the two stops.
    expect(at.vehicle.lng).toBeCloseTo(0.5, 3);
  });

  it("switches to holding once it arrives", () => {
    const at = sampleFollow(schedule, timeline, timeline.arrivals[1] + 1);

    expect(at).toMatchObject({ stopIndex: 1, dwelling: true });
    expect(at.vehicle.lng).toBeCloseTo(1, 6);
  });

  it("holds at the terminus at the end of the run", () => {
    // `runSeconds` itself is the first instant of the *next* run, so sample just short of it.
    const at = sampleFollow(schedule, timeline, timeline.runSeconds - 0.001);

    expect(at).toMatchObject({ stopIndex: 2, dwelling: true });
    expect(at.vehicle.lng).toBeCloseTo(2, 6);
  });

  it("loops back to the origin for the next run", () => {
    const at = sampleFollow(schedule, timeline, timeline.runSeconds + 1);

    expect(at).toMatchObject({ stopIndex: 0, dwelling: true, run: 1 });
    expect(at.vehicle.lng).toBeCloseTo(0, 6);
  });

  it("stays on the map when the route type has no speed", () => {
    // Zero speed collapses every hop to nothing; the run must degrade to a
    // stationary vehicle rather than dividing by zero into NaN coordinates.
    const still = scheduleFor(["p0", "p1"], [0, 1], 0);
    const stillTimeline = buildFollowTimeline(still)!;
    const at = sampleFollow(still, stillTimeline, stillTimeline.runSeconds / 2);

    expect(Number.isFinite(at.vehicle.lng)).toBe(true);
    expect(Number.isFinite(at.vehicle.lat)).toBe(true);
  });
});
