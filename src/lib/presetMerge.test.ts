import { describe, expect, it } from "vitest";
import { findRouteMergeCandidates } from "./presetMerge";
import { MergeStop } from "./presetMerge";
import { Stop } from "./types";

const NY: Stop = { id: "ny", name: "New York Penn Station", lng: -73.9939, lat: 40.7506 };
const DC: Stop = { id: "dc", name: "Washington Union Station", lng: -77.0068, lat: 38.8973 };

describe("findRouteMergeCandidates", () => {
  it("matches a preset stop sitting on an existing station", () => {
    const stops: MergeStop[] = [{ name: "NY Penn", lng: -73.9939, lat: 40.7506 }];
    const [candidate, ...rest] = findRouteMergeCandidates([NY, DC], stops);

    expect(rest).toHaveLength(0);
    expect(candidate.stopIndex).toBe(0);
    expect(candidate.existingStop).toBe(NY);
    expect(candidate.distanceMeters).toBeLessThan(1);
  });

  it("absorbs the small coordinate drift between independently-researched stops", () => {
    // ~40m north of the existing NY stop — the same real station, nudged.
    const stops: MergeStop[] = [{ name: "New York", lng: -73.9939, lat: 40.751 }];
    const candidates = findRouteMergeCandidates([NY], stops);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].existingStop).toBe(NY);
  });

  it("ignores stops beyond the threshold", () => {
    const stops: MergeStop[] = [{ name: "Somewhere else", lng: -75.0, lat: 39.9 }];
    expect(findRouteMergeCandidates([NY, DC], stops)).toEqual([]);
  });

  it("picks the nearest existing station when several are close", () => {
    const near: Stop = { id: "near", name: "Nearer", lng: -73.9939, lat: 40.7507 };
    const far: Stop = { id: "far", name: "Farther", lng: -73.9939, lat: 40.7514 };
    const stops: MergeStop[] = [{ name: "Target", lng: -73.9939, lat: 40.7506 }];

    const [candidate] = findRouteMergeCandidates([far, near], stops);
    expect(candidate.existingStop).toBe(near);
  });

  it("reports the stop index so unrelated stops keep their position", () => {
    const stops: MergeStop[] = [
      { name: "Far", lng: -80, lat: 35 },
      { name: "On DC", lng: -77.0068, lat: 38.8973 },
    ];
    const candidates = findRouteMergeCandidates([DC], stops);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].stopIndex).toBe(1);
    expect(candidates[0].existingStop).toBe(DC);
  });

  it("returns nothing on an empty map", () => {
    const stops: MergeStop[] = [{ name: "NY Penn", lng: -73.9939, lat: 40.7506 }];
    expect(findRouteMergeCandidates([], stops)).toEqual([]);
  });
});
