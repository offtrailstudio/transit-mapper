import { speedForRoute } from "./lineKinds";
import { primaryStopIds } from "./lines";
import { buildRouteSchedule } from "./simulation";
import { Route, Stop, TransitMapData } from "./types";

export type TimetableStop = {
  stopId: string;
  name: string;
  /** Seconds from the trip's departure until a vehicle arrives at this stop. */
  arrivalSec: number;
  /** Arrival + dwell; equals arrivalSec at the first and last stops. */
  departureSec: number;
};

export type RouteTimetable = {
  routeId: string;
  routeName: string;
  color: string;
  /** Headway between successive departures, seconds (0 when unset). */
  headwaySec: number;
  /** End-to-end trip duration, seconds (= the last stop's arrivalSec). */
  tripSeconds: number;
  stops: TimetableStop[];
};

/**
 * One trip's stop-by-stop timing for a route's primary pattern, derived from the
 * exact dwell-aware schedule the simulation runs on — so a printed timetable can
 * never drift from the animated vehicles. Returns null when fewer than two of the
 * route's stops resolve (no trip to time). Pixel offsets don't affect timing, so
 * an empty offset list is handed to the schedule builder.
 */
export function buildRouteTimetable(data: TransitMapData, route: Route): RouteTimetable | null {
  const stopsById = new Map<string, Stop>(data.stops.map((s) => [s.id, s]));
  const schedule = buildRouteSchedule(route, stopsById, speedForRoute(data, route), []);
  if (!schedule) {
    return null;
  }

  // The same contiguous prefix buildRouteSchedule timed: it stops at the first
  // gap, so resolve stops the same way to keep names aligned with the knots.
  const resolved: Stop[] = [];
  for (const id of primaryStopIds(route)) {
    const stop = stopsById.get(id);
    if (!stop) {
      break;
    }
    resolved.push(stop);
  }

  return {
    routeId: route.id,
    routeName: route.name || "Untitled route",
    color: route.routeColor,
    headwaySec: (route.headwayMin ?? 0) * 60,
    tripSeconds: schedule.tripSeconds,
    stops: stopTimesFromKnots(schedule.knots, resolved),
  };
}

/**
 * Reads per-stop arrival/departure times out of the schedule's knots. buildKnots
 * lays them out as: stop 0 at t=0, then an (arrival, dwell) pair per intermediate
 * stop, then a lone arrival for the last stop — so we consume two knots per
 * intermediate stop and one at each end.
 */
function stopTimesFromKnots(knots: { t: number[]; d: number[] }, resolved: Stop[]): TimetableStop[] {
  const { t } = knots;
  const out: TimetableStop[] = [
    { stopId: resolved[0].id, name: resolved[0].name, arrivalSec: t[0], departureSec: t[0] },
  ];
  let i = 1;
  for (let k = 1; k < resolved.length; k++) {
    const isLast = k === resolved.length - 1;
    const arrivalSec = t[i];
    const departureSec = isLast ? arrivalSec : t[i + 1];
    out.push({ stopId: resolved[k].id, name: resolved[k].name, arrivalSec, departureSec });
    i += isLast ? 1 : 2;
  }
  return out;
}

/**
 * The stop a vehicle is currently at (or most recently reached) `elapsedSec` into
 * its trip, or null when it isn't in flight (before departure or past the final
 * arrival). Drives the live cell highlight: for each departure column, the cell of
 * that trip's current station lights up, sweeping down the grid as the sim clock
 * advances.
 */
export function stopIndexAt(stops: TimetableStop[], tripSeconds: number, elapsedSec: number): number | null {
  if (elapsedSec < 0 || elapsedSec > tripSeconds || stops.length === 0) {
    return null;
  }
  let index = 0;
  for (let i = 0; i < stops.length; i++) {
    if (elapsedSec < stops[i].arrivalSec) {
      break;
    }
    index = i;
  }
  return index;
}

/**
 * Clock times (seconds since midnight) at which trips leave the origin: from
 * `firstSec` every `headwaySec` up to and including `lastSec`. Empty when the
 * headway is non-positive or the window is inverted.
 */
export function tripDepartures(firstSec: number, headwaySec: number, lastSec: number): number[] {
  if (headwaySec <= 0 || lastSec < firstSec) {
    return [];
  }
  const out: number[] = [];
  for (let s = firstSec; s <= lastSec; s += headwaySec) {
    out.push(s);
  }
  return out;
}

/** Formats seconds-since-midnight as "HH:MM" (24h, wrapping past a day). */
export function secondsToClock(sec: number): string {
  const minutes = Math.floor(sec / 60) % (24 * 60);
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
