import { describe, expect, it } from "vitest";
import { getUnassignedStops, getVisibleStops } from "./selectors";
import { TransitMapData } from "./types";

describe("getUnassignedStops", () => {
  it("returns stops not present in any route's stops", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [
        { id: "p1", name: "A", lng: 0, lat: 0 },
        { id: "p2", name: "B", lng: 1, lat: 1 },
      ],
      routes: [{ id: "l1", name: "Route 1", routeColor: "#fff", patterns: [{ id: "l1-p", stopIds: ["p1"] }] }],
    };
    expect(getUnassignedStops(data)).toEqual([data.stops[1]]);
  });

  it("returns all stops when there are no routes", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [{ id: "p1", name: "A", lng: 0, lat: 0 }],
      routes: [],
    };
    expect(getUnassignedStops(data)).toEqual(data.stops);
  });

  it("returns an empty array when every stop is assigned", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [{ id: "p1", name: "A", lng: 0, lat: 0 }],
      routes: [{ id: "l1", name: "Route 1", routeColor: "#fff", patterns: [{ id: "l1-p", stopIds: ["p1"] }] }],
    };
    expect(getUnassignedStops(data)).toEqual([]);
  });
});

describe("getVisibleStops", () => {
  const stop = (id: string): { id: string; name: string; lng: number; lat: number } => ({
    id,
    name: id,
    lng: 0,
    lat: 0,
  });
  const route = (id: string, stopIds: string[], hidden?: boolean) => ({
    id,
    name: id,
    routeColor: "#fff",
    hidden,
    patterns: [{ id: `${id}-p`, stopIds }],
  });

  it("hides a stop when the only route serving it is hidden", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("p1"), stop("p2")],
      routes: [route("l1", ["p1"], true), route("l2", ["p2"])],
    };
    expect(getVisibleStops(data).map((s) => s.id)).toEqual(["p2"]);
  });

  it("keeps a stop shared with a visible route when one of its routes is hidden", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("p1")],
      routes: [route("l1", ["p1"], true), route("l2", ["p1"])],
    };
    expect(getVisibleStops(data).map((s) => s.id)).toEqual(["p1"]);
  });

  it("keeps unassigned stops regardless of hidden routes", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("p1"), stop("free")],
      routes: [route("l1", ["p1"], true)],
    };
    expect(getVisibleStops(data).map((s) => s.id)).toEqual(["free"]);
  });

  it("returns all stops when no route is hidden", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [stop("p1"), stop("p2")],
      routes: [route("l1", ["p1"]), route("l2", ["p2"])],
    };
    expect(getVisibleStops(data).map((s) => s.id)).toEqual(["p1", "p2"]);
  });
});
