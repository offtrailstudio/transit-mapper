import { describe, expect, it } from "vitest";
import { offsetPolyline } from "./offsetPolyline";

describe("offsetPolyline", () => {
  it("returns the input unchanged for a zero offset", () => {
    const points: [number, number][] = [
      [0, 0],
      [10, 0],
    ];
    expect(offsetPolyline(points, 0)).toBe(points);
  });

  it("returns the input unchanged for fewer than two points", () => {
    const points: [number, number][] = [[0, 0]];
    expect(offsetPolyline(points, 5)).toBe(points);
  });

  it("shifts a straight line perpendicular to its direction", () => {
    const result = offsetPolyline(
      [
        [0, 0],
        [10, 0],
      ],
      5
    );
    expect(result).toEqual([
      [0, 5],
      [10, 5],
    ]);
  });

  it("flips sides for a negative offset", () => {
    const result = offsetPolyline(
      [
        [0, 0],
        [10, 0],
      ],
      -5
    );
    expect(result).toEqual([
      [0, -5],
      [10, -5],
    ]);
  });

  it("miter-joins a 90-degree bend so both legs stay a true parallel distance away", () => {
    const [start, bend, end] = offsetPolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      5
    );
    // Endpoints (single adjacent segment) offset by exactly the given distance.
    expect(start[0]).toBeCloseTo(0, 5);
    expect(start[1]).toBeCloseTo(5, 5);
    expect(end[0]).toBeCloseTo(5, 5);
    expect(end[1]).toBeCloseTo(10, 5);
    // The interior corner moves along the bisector by offset * sqrt(2) for a
    // 90-degree turn, so both legs remain exactly 5 units from the original.
    expect(bend[0]).toBeCloseTo(5, 5);
    expect(bend[1]).toBeCloseTo(5, 5);
  });

  it("keeps every offset vertex a consistent perpendicular distance from its original segment", () => {
    const original: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    const offset = offsetPolyline(original, 5);

    function distanceToSegment(p: [number, number], a: [number, number], b: [number, number]) {
      const [ax, ay] = a;
      const [bx, by] = b;
      const [px, py] = p;
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;
      const t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
      const closest = [ax + t * dx, ay + t * dy];
      return Math.hypot(px - closest[0], py - closest[1]);
    }

    expect(distanceToSegment(offset[0], original[0], original[1])).toBeCloseTo(5, 5);
    expect(distanceToSegment(offset[1], original[0], original[1])).toBeCloseTo(5, 5);
    expect(distanceToSegment(offset[1], original[1], original[2])).toBeCloseTo(5, 5);
    expect(distanceToSegment(offset[2], original[1], original[2])).toBeCloseTo(5, 5);
  });
});
