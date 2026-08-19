import { DWELL_SECONDS, speedForRoute } from "./lineKinds";
import { routeEdgeOffsets } from "./lineGeometry";
import { primaryStopIds } from "./lines";
import { octilinearPath } from "./octilinear";
import { approxMetersBetween } from "./stationClusters";
import { Route, Stop, TransitMapData } from "./types";

/** Knots of a piecewise (time → distance-along-path) profile. Flat spans are dwells. */
type Knots = { t: number[]; d: number[] };

export type RouteSchedule = {
  routeId: string;
  color: string;
  /** Full octilinear polyline (lng/lat) in the route's forward direction. */
  coords: [number, number][];
  /** Metres of each sub-segment (length = coords.length - 1). */
  segMeters: number[];
  /** Painted pixel offset of each sub-segment, so vehicles ride the drawn track. */
  segOffsetPx: number[];
  /** Cumulative metres at each vertex (length = coords.length). */
  cumMeters: number[];
  totalMeters: number;
  /** Seconds for one end-to-end trip, including dwell at intermediate stops. */
  tripSeconds: number;
  headwaySeconds: number;
  /** Time→distance profile for the trip (flat spans are dwells). */
  knots: Knots;
};

export type Vehicle = {
  lng: number;
  lat: number;
  /** Compass heading of travel, degrees. */
  bearing: number;
  /** Painted pixel offset of the track segment under the vehicle. */
  offsetPx: number;
  dwelling: boolean;
};

const MS_PER_KMH = 1000 / 3600;

function bearingDeg(a: [number, number], b: [number, number]): number {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Builds the (time → distance) knots for a trip that visits `stopDists` in
 * order, cruising at `speedMps` between them and holding `DWELL_SECONDS` at
 * every intermediate stop.
 */
function buildKnots(stopDists: number[], speedMps: number): Knots {
  const t = [0];
  const d = [stopDists[0]];
  let clock = 0;
  for (let k = 1; k < stopDists.length; k++) {
    const cruise = speedMps > 0 ? Math.abs(stopDists[k] - stopDists[k - 1]) / speedMps : 0;
    clock += cruise;
    t.push(clock);
    d.push(stopDists[k]);
    const isIntermediate = k < stopDists.length - 1;
    if (isIntermediate) {
      clock += DWELL_SECONDS;
      t.push(clock);
      d.push(stopDists[k]);
    }
  }
  return { t, d };
}

/** Distance along the path at trip-elapsed `seconds`, and whether the vehicle is dwelling. */
function sampleKnots(knots: Knots, seconds: number): { distance: number; dwelling: boolean } {
  const { t, d } = knots;
  if (seconds <= t[0]) return { distance: d[0], dwelling: false };
  const last = t.length - 1;
  if (seconds >= t[last]) return { distance: d[last], dwelling: false };
  for (let i = 0; i < last; i++) {
    if (seconds >= t[i] && seconds <= t[i + 1]) {
      const dt = t[i + 1] - t[i];
      if (dt === 0 || d[i + 1] === d[i]) {
        return { distance: d[i], dwelling: d[i + 1] === d[i] };
      }
      const frac = (seconds - t[i]) / dt;
      return { distance: d[i] + frac * (d[i + 1] - d[i]), dwelling: false };
    }
  }
  return { distance: d[last], dwelling: false };
}

function pointAtDistance(
  schedule: RouteSchedule,
  meters: number
): { lng: number; lat: number; bearing: number; offsetPx: number } {
  const clamped = Math.max(0, Math.min(meters, schedule.totalMeters));
  const { coords, cumMeters, segMeters, segOffsetPx } = schedule;
  for (let j = 0; j < coords.length - 1; j++) {
    if (clamped >= cumMeters[j] && clamped <= cumMeters[j + 1]) {
      const segLen = segMeters[j];
      const frac = segLen > 0 ? (clamped - cumMeters[j]) / segLen : 0;
      const a = coords[j];
      const b = coords[j + 1];
      return {
        lng: a[0] + frac * (b[0] - a[0]),
        lat: a[1] + frac * (b[1] - a[1]),
        bearing: bearingDeg(a, b),
        offsetPx: segOffsetPx[j],
      };
    }
  }
  const lastIndex = coords.length - 1;
  const a = coords[Math.max(0, lastIndex - 1)];
  const b = coords[lastIndex];
  return { lng: b[0], lat: b[1], bearing: bearingDeg(a, b), offsetPx: segOffsetPx[lastIndex - 1] ?? 0 };
}

/**
 * Turns one route into a movement schedule, or null if fewer than two of its
 * stops resolve to stops. The path is the same octilinear geometry the map
 * draws; building it stops at the first gap so a missing mid-route stop can't
 * teleport a vehicle across the map.
 */
export function buildRouteSchedule(
  route: Route,
  stopsById: Map<string, Stop>,
  speedKmh: number,
  offsets: number[]
): RouteSchedule | null {
  const coords: [number, number][] = [];
  const segOffsetPx: number[] = [];
  const stopVertexIndices: number[] = [];

  const stopIds = primaryStopIds(route);
  for (let i = 0; i < stopIds.length - 1; i++) {
    const a = stopsById.get(stopIds[i]);
    const b = stopsById.get(stopIds[i + 1]);
    if (!a || !b) break;

    const path = octilinearPath([a.lng, a.lat], [b.lng, b.lat]);
    if (coords.length === 0) {
      coords.push(path[0]);
      stopVertexIndices.push(0);
    }
    for (let p = 1; p < path.length; p++) {
      coords.push(path[p]);
      segOffsetPx.push(offsets[i] ?? 0);
    }
    stopVertexIndices.push(coords.length - 1);
  }

  if (coords.length < 2) return null;

  const segMeters: number[] = [];
  const cumMeters: number[] = [0];
  for (let j = 0; j < coords.length - 1; j++) {
    const m = approxMetersBetween(
      { lng: coords[j][0], lat: coords[j][1] },
      { lng: coords[j + 1][0], lat: coords[j + 1][1] }
    );
    segMeters.push(m);
    cumMeters.push(cumMeters[j] + m);
  }
  const totalMeters = cumMeters[cumMeters.length - 1];

  const speedMps = speedKmh * MS_PER_KMH;
  const stopDists = stopVertexIndices.map((idx) => cumMeters[idx]);
  const knots = buildKnots(stopDists, speedMps);
  const tripSeconds = knots.t[knots.t.length - 1];
  const headwaySeconds = (route.headwayMin ?? 0) * 60;

  return {
    routeId: route.id,
    color: route.routeColor,
    coords,
    segMeters,
    segOffsetPx,
    cumMeters,
    totalMeters,
    tripSeconds,
    headwaySeconds,
    knots,
  };
}

export function buildRouteSchedules(data: TransitMapData): RouteSchedule[] {
  const stopsById = new Map(data.stops.map((p) => [p.id, p]));
  const offsetsByRoute = routeEdgeOffsets(data);
  const schedules: RouteSchedule[] = [];
  for (const route of data.routes) {
    const schedule = buildRouteSchedule(
      route,
      stopsById,
      speedForRoute(data, route),
      offsetsByRoute.get(route.id) ?? []
    );
    if (schedule) schedules.push(schedule);
  }
  return schedules;
}

/**
 * Every vehicle on a route at simulated time `simSeconds`, travelling in stop
 * order. Departures are spaced by the headway with no service window, so at any
 * time the route carries `floor(tripSeconds / headway) + 1` vehicles — the
 * density is emergent from speed and frequency, not a separate control.
 */
export function vehiclePositions(schedule: RouteSchedule, simSeconds: number): Vehicle[] {
  const { tripSeconds, headwaySeconds, knots } = schedule;
  if (tripSeconds <= 0 || headwaySeconds <= 0) return [];

  const vehicles: Vehicle[] = [];
  const kMax = Math.floor(simSeconds / headwaySeconds);
  const kMin = Math.ceil((simSeconds - tripSeconds) / headwaySeconds);

  for (let k = kMin; k <= kMax; k++) {
    const elapsed = simSeconds - k * headwaySeconds;
    if (elapsed < 0 || elapsed > tripSeconds) continue;
    const { distance, dwelling } = sampleKnots(knots, elapsed);
    const pos = pointAtDistance(schedule, distance);
    vehicles.push({
      lng: pos.lng,
      lat: pos.lat,
      bearing: pos.bearing,
      offsetPx: pos.offsetPx,
      dwelling,
    });
  }
  return vehicles;
}
