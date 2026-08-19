import { describe, expect, it } from "vitest";
import { octilinearPath, octilinearPathPlane } from "./octilinear";

describe("octilinearPathPlane", () => {
  it("returns a straight line when already octilinear", () => {
    expect(octilinearPathPlane([0, 0], [10, 0])).toEqual([
      [0, 0],
      [10, 0],
    ]);
    expect(octilinearPathPlane([0, 0], [5, 5])).toEqual([
      [0, 0],
      [5, 5],
    ]);
  });

  it("bends diagonal-then-axis through one point, without Mercator distortion", () => {
    // A shallow rightward-up run: 45° diagonal first, then horizontal. Because
    // it works directly in plane space, the bend is exact (unlike octilinearPath,
    // which projects lng/lat and lands on non-round coordinates).
    expect(octilinearPathPlane([0, 0], [10, 4])).toEqual([
      [0, 0],
      [4, 4],
      [10, 4],
    ]);
  });

  it("every leg moves at a multiple of 45 degrees", () => {
    const path = octilinearPathPlane([0, 0], [3, 8]);
    for (let i = 1; i < path.length; i++) {
      const dx = path[i][0] - path[i - 1][0];
      const dy = path[i][1] - path[i - 1][1];
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      expect(adx === 0 || ady === 0 || adx === ady).toBe(true);
    }
  });
});

describe("octilinearPath", () => {
  it("stays a straight 2-point line when already horizontal", () => {
    const path = octilinearPath([0, 0], [10, 0]);
    expect(path).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });

  it("stays a straight 2-point line when already vertical", () => {
    const path = octilinearPath([0, 0], [0, 10]);
    expect(path).toEqual([
      [0, 0],
      [0, 10],
    ]);
  });

  it("bends diagonal-then-straight when the destination is mostly east", () => {
    const [start, bend, end] = octilinearPath([0, 0], [10, 2]);
    expect(start).toEqual([0, 0]);
    expect(end).toEqual([10, 2]);
    // the diagonal leg covers the smaller delta (latitude) fully, so the
    // bend point already sits at the destination's latitude...
    expect(bend[1]).toBeCloseTo(2, 1);
    // ...while only partway toward the destination's longitude.
    expect(bend[0]).toBeGreaterThan(0);
    expect(bend[0]).toBeLessThan(10);
  });

  it("bends diagonal-then-straight when the destination is mostly north", () => {
    const [start, bend, end] = octilinearPath([0, 0], [2, 10]);
    expect(start).toEqual([0, 0]);
    expect(end).toEqual([2, 10]);
    expect(bend[0]).toBeCloseTo(2, 1);
    expect(bend[1]).toBeGreaterThan(0);
    expect(bend[1]).toBeLessThan(10);
  });

  it("bends toward the correct quadrant for negative deltas", () => {
    const [, bend] = octilinearPath([0, 0], [-10, -2]);
    expect(bend[0]).toBeLessThan(0);
    expect(bend[1]).toBeCloseTo(-2, 1);
  });
});
