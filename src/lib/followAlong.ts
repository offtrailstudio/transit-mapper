import { pointAtDistance, RouteSchedule, Vehicle } from "./simulation";

/**
 * How long the followed vehicle holds at each stop, in **real** seconds.
 *
 * This is the one duration in the simulation that isn't simulated: the hold
 * exists to be *read*, and readability is a wall-clock property. Expressed in
 * simulated seconds it can't survive the multiplier — 20 sim-seconds read as a
 * comfortable 4s at 5× but a 332ms flash at 60×, which is no pause at all.
 * Callers convert with `followDwellSeconds(multiplier)`.
 */
export const FOLLOW_DWELL_REAL_SECONDS = 2;

/**
 * The dwell in *simulated* seconds that plays back as `FOLLOW_DWELL_REAL_SECONDS`
 * at the given playback multiplier. The consequence is that the sim clock gallops
 * during a follow run (two simulated minutes per stop at 60×) — acceptable
 * because a follow run's timeline is already synthetic: it holds at every stop
 * including the origin and terminus, which no real schedule does. The timetable
 * runs off `buildRouteSchedule`, not this, so printed times stay honest.
 */
export function followDwellSeconds(multiplier: number): number {
  return FOLLOW_DWELL_REAL_SECONDS * Math.max(1, multiplier);
}

/**
 * When a follow-along run holds and when it moves. Unlike the network
 * simulation — many vehicles spaced by a headway, dwelling only at intermediate
 * stops — a follow-along run is *one* vehicle that holds at **every** stop
 * including the origin and terminus, then loops back to the origin. The origin
 * dwell is what gives the run a readable first beat instead of departing before
 * the name is on screen.
 */
export type FollowTimeline = {
  routeId: string;
  /** Stop ids in travel order (the schedule's served stops, so it can't name a stop the vehicle skips). */
  stopIds: string[];
  /** Simulated second the vehicle arrives at each stop — when its dwell begins. */
  arrivals: number[];
  /** Simulated second the vehicle leaves each stop (`arrivals[i] + dwellSeconds`). */
  departures: number[];
  /** One end-to-end run: the origin dwell through the end of the terminus dwell. */
  runSeconds: number;
};

export type FollowPosition = {
  vehicle: Vehicle;
  /** Index into `stopIds` of the stop being held at, or — while moving — the one being approached. */
  stopIndex: number;
  /** True while holding at `stopIndex`, false while travelling towards it. */
  dwelling: boolean;
  /** How many complete runs preceded this one; the run repeats forever. */
  run: number;
};

/**
 * Turns a route's schedule into a single-vehicle run, or null if the route has
 * fewer than two stops to travel between.
 */
export function buildFollowTimeline(
  schedule: RouteSchedule,
  /** Simulated seconds to hold at each stop — from `followDwellSeconds(multiplier)`. */
  dwellSeconds: number = FOLLOW_DWELL_REAL_SECONDS
): FollowTimeline | null {
  const { stopIds, stopMeters, speedMps } = schedule;
  if (stopIds.length < 2) return null;

  const arrivals = [0];
  const departures = [dwellSeconds];
  for (let i = 1; i < stopIds.length; i++) {
    const gap = Math.abs(stopMeters[i] - stopMeters[i - 1]);
    const cruise = speedMps > 0 ? gap / speedMps : 0;
    arrivals.push(departures[i - 1] + cruise);
    departures.push(arrivals[i] + dwellSeconds);
  }

  return {
    routeId: schedule.routeId,
    stopIds,
    arrivals,
    departures,
    runSeconds: departures[departures.length - 1],
  };
}

/** Where the followed vehicle is at simulated time `simSeconds`, and which stop that reads as. */
export function sampleFollow(
  schedule: RouteSchedule,
  timeline: FollowTimeline,
  simSeconds: number
): FollowPosition {
  const { arrivals, departures, runSeconds } = timeline;
  const { stopMeters } = schedule;

  // A zero-length run (no dwell and stops on top of each other) would divide by
  // zero below; park at the origin rather than producing NaN coordinates.
  if (runSeconds <= 0) {
    return { vehicle: vehicleAt(schedule, stopMeters[0], true), stopIndex: 0, dwelling: true, run: 0 };
  }

  const run = Math.floor(simSeconds / runSeconds);
  const elapsed = simSeconds - run * runSeconds;

  let i = arrivals.length - 1;
  while (i > 0 && elapsed < arrivals[i]) {
    i--;
  }

  if (elapsed <= departures[i]) {
    return { vehicle: vehicleAt(schedule, stopMeters[i], true), stopIndex: i, dwelling: true, run };
  }

  // Past the dwell at `i` and before arriving at `i + 1` — which exists, because
  // `elapsed <= runSeconds`, the end of the last stop's dwell.
  const span = arrivals[i + 1] - departures[i];
  const frac = span > 0 ? (elapsed - departures[i]) / span : 1;
  const meters = stopMeters[i] + frac * (stopMeters[i + 1] - stopMeters[i]);
  return { vehicle: vehicleAt(schedule, meters, false), stopIndex: i + 1, dwelling: false, run };
}

function vehicleAt(schedule: RouteSchedule, meters: number, dwelling: boolean): Vehicle {
  const { lng, lat, bearing, offsetPx } = pointAtDistance(schedule, meters);
  return { lng, lat, bearing, offsetPx, dwelling };
}
