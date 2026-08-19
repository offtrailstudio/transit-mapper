import { describe, expect, it } from "vitest";
import { DWELL_SECONDS } from "./lineKinds";
import {
  buildRouteTimetable,
  secondsToClock,
  stopIndexAt,
  tripDepartures,
  type TimetableStop,
} from "./timetable";
import { Route, TransitMapData } from "./types";

function route(stopIds: string[]): Route {
  return {
    id: "r",
    name: "R",
    routeColor: "#000000",
    routeType: "bus",
    headwayMin: 10,
    patterns: [{ id: "p", stopIds }],
  };
}

function map(stopIds: string[]): TransitMapData {
  return {
    version: 3,
    title: "T",
    // Collinear, evenly spaced so the two hops are comparable.
    stops: [
      { id: "a", name: "A", lng: 0, lat: 0 },
      { id: "b", name: "B", lng: 0.01, lat: 0 },
      { id: "c", name: "C", lng: 0.02, lat: 0 },
    ],
    routes: [route(stopIds)],
  };
}

describe("buildRouteTimetable", () => {
  it("times every stop, dwelling only at intermediate stops", () => {
    const data = map(["a", "b", "c"]);
    const tt = buildRouteTimetable(data, data.routes[0])!;

    expect(tt.stops.map((s) => s.name)).toEqual(["A", "B", "C"]);
    expect(tt.headwaySec).toBe(600);

    const [a, b, c] = tt.stops;
    // Origin departs at t=0, no dwell.
    expect(a.arrivalSec).toBe(0);
    expect(a.departureSec).toBe(0);
    // Intermediate stop holds exactly one dwell.
    expect(b.departureSec - b.arrivalSec).toBe(DWELL_SECONDS);
    // Terminus arrives and doesn't dwell; its arrival is the trip length.
    expect(c.departureSec).toBe(c.arrivalSec);
    expect(tt.tripSeconds).toBeCloseTo(c.arrivalSec, 5);
    // Arrivals strictly increase along the trip.
    expect(a.arrivalSec).toBeLessThan(b.arrivalSec);
    expect(b.arrivalSec).toBeLessThan(c.arrivalSec);
  });

  it("returns null when fewer than two stops resolve", () => {
    const data = map(["a"]);
    expect(buildRouteTimetable(data, data.routes[0])).toBeNull();
  });

  it("stops timing at the first unresolved stop", () => {
    const data = map(["a", "b", "missing", "c"]);
    const tt = buildRouteTimetable(data, data.routes[0])!;
    // Only the contiguous a→b prefix is timed.
    expect(tt.stops.map((s) => s.name)).toEqual(["A", "B"]);
  });
});

describe("tripDepartures", () => {
  it("lists departures across the window, inclusive", () => {
    expect(tripDepartures(0, 600, 1800)).toEqual([0, 600, 1200, 1800]);
  });

  it("is empty for a non-positive headway or inverted window", () => {
    expect(tripDepartures(0, 0, 1000)).toEqual([]);
    expect(tripDepartures(1000, 600, 0)).toEqual([]);
  });
});

describe("stopIndexAt", () => {
  // A→B (100s) · 30s dwell at B · B→C (100s); trip = 230s.
  const stops: TimetableStop[] = [
    { stopId: "a", name: "A", arrivalSec: 0, departureSec: 0 },
    { stopId: "b", name: "B", arrivalSec: 100, departureSec: 130 },
    { stopId: "c", name: "C", arrivalSec: 230, departureSec: 230 },
  ];
  const trip = 230;

  it("returns the most recently reached stop", () => {
    expect(stopIndexAt(stops, trip, 0)).toBe(0);
    expect(stopIndexAt(stops, trip, 50)).toBe(0); // A→B
    expect(stopIndexAt(stops, trip, 115)).toBe(1); // dwelling at B
    expect(stopIndexAt(stops, trip, 180)).toBe(1); // B→C
    expect(stopIndexAt(stops, trip, 230)).toBe(2); // arrived at C
  });

  it("returns null when the trip isn't in flight", () => {
    expect(stopIndexAt(stops, trip, -1)).toBeNull();
    expect(stopIndexAt(stops, trip, 231)).toBeNull();
  });
});

describe("secondsToClock", () => {
  it("formats HH:MM and wraps past a day", () => {
    expect(secondsToClock(0)).toBe("00:00");
    expect(secondsToClock(6 * 3600 + 5 * 60)).toBe("06:05");
    expect(secondsToClock(23 * 3600 + 59 * 60)).toBe("23:59");
    expect(secondsToClock(25 * 3600)).toBe("01:00");
  });
});
