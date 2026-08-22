import { describe, expect, it } from "vitest";
import { BUNDLED_NETWORKS } from "./groups";
import { BUNDLED_ROUTES } from "./index";
import { resolveRouteMode } from "./groupLines";
import { ROUTE_TYPES } from "../lineKinds";

describe("BUNDLED_ROUTES", () => {
  it("every route has at least 2 stops", () => {
    for (const route of BUNDLED_ROUTES) {
      expect(route.stops.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("has unique ids across the whole catalog", () => {
    const ids = BUNDLED_ROUTES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Tighter than world bounds (-180..180, -90..90) on purpose, while the catalog is US/Canada-only —
  // this catches a transposed lng/lat typo that a world-scale bound wouldn't. Loosen when a
  // non-North-American group is added.
  it("every stop's coordinates are within plausible North America bounds", () => {
    for (const route of BUNDLED_ROUTES) {
      for (const stop of route.stops) {
        expect(stop.lng).toBeGreaterThan(-170);
        expect(stop.lng).toBeLessThan(-50);
        expect(stop.lat).toBeGreaterThan(15);
        expect(stop.lat).toBeLessThan(72);
      }
    }
  });

  it("every referenced groupId exists in the group registry", () => {
    const groupIds = new Set(BUNDLED_NETWORKS.map((g) => g.id));
    for (const route of BUNDLED_ROUTES) {
      if (route.groupId) {
        expect(groupIds.has(route.groupId)).toBe(true);
      }
    }
  });

  it("every color, if present, is a valid hex code", () => {
    for (const route of BUNDLED_ROUTES) {
      if (route.color) {
        expect(route.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("ships the UCAT bus network, all typed as buses", () => {
    const ucat = BUNDLED_ROUTES.filter((l) => l.groupId === "ucat");
    expect(ucat.length).toBeGreaterThanOrEqual(10);
    for (const route of ucat) {
      expect(route.routeType).toBe("bus");
    }
  });

  it("resolves a transit mode for every route", () => {
    const groupsById = new Map(BUNDLED_NETWORKS.map((g) => [g.id, g]));
    for (const route of BUNDLED_ROUTES) {
      const group = route.groupId ? groupsById.get(route.groupId) ?? null : null;
      expect(ROUTE_TYPES).toContain(resolveRouteMode(route, group));
    }
  });

  it("types Amtrak as rail, with Acela overriding to high-speed rail", () => {
    const groupsById = new Map(BUNDLED_NETWORKS.map((g) => [g.id, g]));
    const amtrak = BUNDLED_ROUTES.filter((l) => l.groupId === "amtrak");
    for (const route of amtrak) {
      const expected = route.id === "amtrak-acela" ? "hsr" : "rail";
      expect(resolveRouteMode(route, groupsById.get("amtrak")!)).toBe(expected);
    }
  });
});

describe("BUNDLED_NETWORKS", () => {
  it("has unique ids", () => {
    const ids = BUNDLED_NETWORKS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every group declares a default transit mode", () => {
    for (const group of BUNDLED_NETWORKS) {
      expect(group.defaultRouteType).toBeDefined();
    }
  });
});
