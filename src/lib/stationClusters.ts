import { Stop } from "./types";

// Schematic-map tolerance: large enough to absorb the ~30-50m coordinate
// drift between independently-researched preset stops for the same
// real-world station, small enough to not conflate genuinely distinct
// nearby stations (the closest real Amtrak stops are kilometers apart).
export const STATION_MERGE_METERS = 100;

const METERS_PER_DEGREE_LAT = 111_320;

type LngLat = { lng: number; lat: number };

export function approxMetersBetween(a: LngLat, b: LngLat): number {
  const avgLatRad = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(avgLatRad);
  const dLat = (a.lat - b.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (a.lng - b.lng) * metersPerDegreeLng;
  return Math.hypot(dLat, dLng);
}

/**
 * Groups stops within `thresholdMeters` of each other into clusters and
 * returns a map from each stop's id to a representative id shared by every
 * stop in its cluster. Lines built from separately-added presets (or
 * otherwise independently placed stations) end up with distinct Stop
 * records for what's really the same real-world station — this lets
 * shared-segment detection treat them as one node without merging the
 * underlying stops or touching how each route's own stop renders.
 */
export function clusterStations(
  stops: Stop[],
  thresholdMeters: number = STATION_MERGE_METERS
): Map<string, string> {
  const parent = new Map<string, string>();
  stops.forEach((p) => parent.set(p.id, p.id));

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    let cur = id;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  function union(a: string, b: string) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  }

  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      if (approxMetersBetween(stops[i], stops[j]) <= thresholdMeters) {
        union(stops[i].id, stops[j].id);
      }
    }
  }

  const result = new Map<string, string>();
  stops.forEach((p) => result.set(p.id, find(p.id)));
  return result;
}
