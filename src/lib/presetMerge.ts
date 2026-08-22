import { approxMetersBetween, STATION_MERGE_METERS } from "./stationClusters";
import { Stop } from "./types";

/** The geographic minimum the merge check needs — a resolved preset stop supplies it. */
export type MergeStop = { name: string; lng: number; lat: number };

/**
 * A preset stop that lands on top of a station already on the map — the same
 * real-world stop reached from a different route. `stopIndex` is the stop's
 * position in the preset so the reducer can decide, per stop, whether to reuse
 * `existingStop` instead of minting a duplicate.
 */
export type StationMergeCandidate = {
  stopIndex: number;
  stop: MergeStop;
  existingStop: Stop;
  distanceMeters: number;
};

/**
 * For each preset stop, find the nearest existing stop within
 * `thresholdMeters`. Only stops that match get a candidate; the rest are new
 * stations. Matching is by proximity, not name, mirroring how the geometry
 * layer already decides two stops are the same station.
 */
export function findRouteMergeCandidates(
  existingStops: Stop[],
  stops: MergeStop[],
  thresholdMeters: number = STATION_MERGE_METERS
): StationMergeCandidate[] {
  const candidates: StationMergeCandidate[] = [];

  stops.forEach((stop, stopIndex) => {
    let best: { stop: Stop; distance: number } | null = null;
    for (const existingStop of existingStops) {
      const distance = approxMetersBetween(existingStop, stop);
      if (distance <= thresholdMeters && (best === null || distance < best.distance)) {
        best = { stop: existingStop, distance };
      }
    }
    if (best) {
      candidates.push({ stopIndex, stop, existingStop: best.stop, distanceMeters: best.distance });
    }
  });

  return candidates;
}
