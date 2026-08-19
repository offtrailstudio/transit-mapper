import { describe, expect, it } from "vitest";
import { clusterStations, STATION_MERGE_METERS } from "./stationClusters";
import { Stop } from "./types";

function stop(id: string, lng: number, lat: number): Stop {
  return { id, name: id, lng, lat };
}

describe("clusterStations", () => {
  it("clusters two stops at the exact same coordinates", () => {
    const stops = [stop("a", -73.9939, 40.7506), stop("b", -73.9939, 40.7506)];
    const result = clusterStations(stops);
    expect(result.get("a")).toBe(result.get("b"));
  });

  it("clusters stops within the merge threshold", () => {
    // ~0.0005 degrees of lng/lat is well under 100m at this latitude.
    const stops = [stop("a", -87.6398, 41.8789), stop("b", -87.6403, 41.8787)];
    const result = clusterStations(stops, STATION_MERGE_METERS);
    expect(result.get("a")).toBe(result.get("b"));
  });

  it("does not cluster stops well beyond the threshold", () => {
    const stops = [stop("a", -73.9939, 40.7506), stop("b", -74.1644, 40.7342)];
    const result = clusterStations(stops, STATION_MERGE_METERS);
    expect(result.get("a")).not.toBe(result.get("b"));
  });

  it("transitively clusters a chain where the endpoints alone exceed the threshold", () => {
    // a-b ~67m and b-c ~67m (each within the 100m threshold), but a-c ~134m
    // (beyond it) — a and c should still end up in the same cluster via b.
    const stops = [stop("a", 0, 0), stop("b", 0.0006, 0), stop("c", 0.0012, 0)];
    const result = clusterStations(stops, STATION_MERGE_METERS);
    expect(result.get("a")).toBe(result.get("b"));
    expect(result.get("b")).toBe(result.get("c"));
    expect(result.get("a")).toBe(result.get("c"));
  });

  it("gives every unclustered stop its own id", () => {
    const stops = [stop("a", 0, 0), stop("b", 10, 10)];
    const result = clusterStations(stops, STATION_MERGE_METERS);
    expect(result.get("a")).toBe("a");
    expect(result.get("b")).toBe("b");
  });
});
