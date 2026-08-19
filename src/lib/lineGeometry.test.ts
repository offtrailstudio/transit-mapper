import { describe, expect, it } from "vitest";
import { buildRouteRuns } from "./lineGeometry";
import { TransitMapData } from "./types";

function stop(id: string, lng: number, lat: number) {
  return { id, name: id, lng, lat };
}

describe("buildRouteRuns", () => {
  it("connects a route's stops with a straight (already-octilinear) path and no offset", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("a", 0, 0), stop("b", 10, 0)],
      routes: [{ id: "l1", name: "Route 1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a", "b"] }] }],
    };

    const [run] = buildRouteRuns(data);
    expect(run.routeId).toBe("l1");
    expect(run.offsetPixels).toBe(0);
    expect(run.coordinates).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });

  it("drops routes with fewer than two resolvable stops", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("a", 0, 0)],
      routes: [{ id: "l1", name: "Route 1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a"] }] }],
    };

    expect(buildRouteRuns(data)).toEqual([]);
  });

  it("gives routes sharing the same physical segment different (non-overlapping) offsets", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("a", 0, 0), stop("b", 10, 0)],
      routes: [
        { id: "l1", name: "Route 1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a", "b"] }] },
        { id: "l2", name: "Route 2", routeColor: "#00f", patterns: [{ id: "l2-p", stopIds: ["a", "b"] }] },
      ],
    };

    const runs = buildRouteRuns(data);
    const line1 = runs.find((run) => run.routeId === "l1");
    const line2 = runs.find((run) => run.routeId === "l2");
    expect(line1?.offsetPixels).toBe(0);
    expect(line2?.offsetPixels).not.toBe(0);
  });

  it("flips the offset sign for a route that lists the shared stops in reverse order", () => {
    const forward: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("a", 0, 0), stop("b", 10, 0)],
      routes: [
        { id: "l1", name: "Route 1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a", "b"] }] },
        { id: "l2", name: "Route 2", routeColor: "#00f", patterns: [{ id: "l2-p", stopIds: ["a", "b"] }] },
      ],
    };
    const reversed: TransitMapData = {
      ...forward,
      routes: [
        forward.routes[0],
        { ...forward.routes[1], patterns: [{ id: "l2-rev", stopIds: ["b", "a"] }] },
      ],
    };

    const forwardOffset = buildRouteRuns(forward).find((run) => run.routeId === "l2")?.offsetPixels;
    const reversedOffset = buildRouteRuns(reversed).find((run) => run.routeId === "l2")?.offsetPixels;
    expect(reversedOffset).toBe(-(forwardOffset as number));
  });

  it("offsets routes apart even when they use distinct Stop records for the same real-world stops", () => {
    // Simulates two separately-added preset routes: each has its own Stop
    // ids for "the same" stations, a few meters apart rather than sharing
    // one Stop record.
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [
        stop("a1", 0, 0),
        stop("b1", 10, 0),
        stop("a2", 0.00002, 0.00002),
        stop("b2", 10.00002, 0.00002),
      ],
      routes: [
        { id: "l1", name: "Route 1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a1", "b1"] }] },
        { id: "l2", name: "Route 2", routeColor: "#00f", patterns: [{ id: "l2-p", stopIds: ["a2", "b2"] }] },
      ],
    };

    const runs = buildRouteRuns(data);
    const line1 = runs.find((run) => run.routeId === "l1");
    const line2 = runs.find((run) => run.routeId === "l2");
    expect(line1?.offsetPixels).toBe(0);
    expect(line2?.offsetPixels).not.toBe(0);
  });

  it("does not offset routes whose distinct stops are far apart, just because the routes are similar", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("a1", 0, 0), stop("b1", 10, 0), stop("a2", 1, 0), stop("b2", 11, 0)],
      routes: [
        { id: "l1", name: "Route 1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a1", "b1"] }] },
        { id: "l2", name: "Route 2", routeColor: "#00f", patterns: [{ id: "l2-p", stopIds: ["a2", "b2"] }] },
      ],
    };

    const runs = buildRouteRuns(data);
    expect(runs.every((run) => run.offsetPixels === 0)).toBe(true);
  });

  it("keeps parallel routes on a consistent side through a turn (no side-swap at a bend)", () => {
    // Two routes run together through a->b->c and turn at b. The middle stop's
    // id sorts highest, so a sorted-id offset reference would invert between
    // the a-b and b-c segments and flip the second route to the other side at
    // the bend. Ids are chosen so "m" (b) > both neighbors.
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("a", 0, 0), stop("m", 10, 0), stop("c", 10, 10)],
      routes: [
        { id: "l1", name: "Route 1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a", "m", "c"] }] },
        { id: "l2", name: "Route 2", routeColor: "#00f", patterns: [{ id: "l2-p", stopIds: ["a", "m", "c"] }] },
      ],
    };

    const line2Runs = buildRouteRuns(data).filter((run) => run.routeId === "l2");
    // A constant offset across both segments merges into a single run; a flip
    // at the bend would split it into two runs with opposite-signed offsets.
    expect(line2Runs).toHaveLength(1);
    expect(line2Runs[0].offsetPixels).not.toBe(0);
  });

  it("breaks a route into separate runs where its offset changes, and merges where it doesn't", () => {
    // a-b-c all on route 1; a-b is also shared with route 2, b-c is not.
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("a", 0, 0), stop("b", 10, 0), stop("c", 20, 0)],
      routes: [
        // l2 registers first on the shared a-b segment, so l1 (added after)
        // is the one that gets pushed to a non-zero offset there.
        { id: "l2", name: "Route 2", routeColor: "#00f", patterns: [{ id: "l2-p", stopIds: ["a", "b"] }] },
        { id: "l1", name: "Route 1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a", "b", "c"] }] },
      ],
    };

    const line1Runs = buildRouteRuns(data).filter((run) => run.routeId === "l1");
    expect(line1Runs).toHaveLength(2);
    expect(line1Runs[0].offsetPixels).not.toBe(0);
    expect(line1Runs[1].offsetPixels).toBe(0);
  });
});
