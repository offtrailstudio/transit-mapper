import { describe, expect, it } from "vitest";
import { ROUTE_TYPES } from "../lib/lineKinds";
import { routeTypeFromGtfs } from "./routeType";

describe("routeTypeFromGtfs", () => {
  it("maps the basic GTFS Reference types", () => {
    expect(routeTypeFromGtfs(0)).toBe("tram");
    expect(routeTypeFromGtfs(1)).toBe("subway");
    expect(routeTypeFromGtfs(2)).toBe("rail");
    expect(routeTypeFromGtfs(3)).toBe("bus");
    expect(routeTypeFromGtfs(4)).toBe("ferry");
    expect(routeTypeFromGtfs(5)).toBe("tram"); // cable tram
    expect(routeTypeFromGtfs(7)).toBe("tram"); // funicular
    expect(routeTypeFromGtfs(11)).toBe("bus"); // trolleybus
    expect(routeTypeFromGtfs(12)).toBe("subway"); // monorail
  });

  it("promotes only the explicit high-speed rail code to hsr", () => {
    expect(routeTypeFromGtfs(101)).toBe("hsr");
    // Long-distance / regional rail stay `rail`; hsr is an upstream override.
    expect(routeTypeFromGtfs(102)).toBe("rail");
    expect(routeTypeFromGtfs(2)).toBe("rail");
  });

  it("maps extended HVT families by the hundreds bucket", () => {
    expect(routeTypeFromGtfs(100)).toBe("rail");
    expect(routeTypeFromGtfs(109)).toBe("rail"); // suburban railway
    expect(routeTypeFromGtfs(200)).toBe("bus"); // coach
    expect(routeTypeFromGtfs(401)).toBe("subway"); // metro
    expect(routeTypeFromGtfs(402)).toBe("subway"); // underground
    expect(routeTypeFromGtfs(700)).toBe("bus");
    expect(routeTypeFromGtfs(715)).toBe("bus"); // demand-and-response bus
    expect(routeTypeFromGtfs(800)).toBe("bus"); // trolleybus
    expect(routeTypeFromGtfs(900)).toBe("tram");
    expect(routeTypeFromGtfs(1000)).toBe("ferry"); // water transport
    expect(routeTypeFromGtfs(1200)).toBe("ferry");
    expect(routeTypeFromGtfs(1400)).toBe("tram"); // funicular
  });

  it("returns null for classes with no editor equivalent", () => {
    expect(routeTypeFromGtfs(6)).toBeNull(); // aerial lift (basic)
    expect(routeTypeFromGtfs(1100)).toBeNull(); // air
    expect(routeTypeFromGtfs(1300)).toBeNull(); // aerial lift (extended)
    expect(routeTypeFromGtfs(1500)).toBeNull(); // taxi
    expect(routeTypeFromGtfs(1700)).toBeNull(); // miscellaneous
  });

  it("rejects malformed codes", () => {
    expect(routeTypeFromGtfs(-1)).toBeNull();
    expect(routeTypeFromGtfs(1.5)).toBeNull();
    expect(routeTypeFromGtfs(Number.NaN)).toBeNull();
  });

  it("only ever returns a known RouteType or null", () => {
    for (let code = -5; code <= 1800; code++) {
      const result = routeTypeFromGtfs(code);
      if (result !== null) {
        expect(ROUTE_TYPES).toContain(result);
      }
    }
  });
});
