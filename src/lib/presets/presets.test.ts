import { describe, expect, it } from "vitest";
import { PRESET_GROUPS } from "./groups";
import { PRESET_LINES } from "./index";

describe("PRESET_LINES", () => {
  it("every route has at least 2 stops", () => {
    for (const route of PRESET_LINES) {
      expect(route.stops.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("has unique ids across the whole catalog", () => {
    const ids = PRESET_LINES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Tighter than world bounds (-180..180, -90..90) on purpose, while the catalog is US/Canada-only —
  // this catches a transposed lng/lat typo that a world-scale bound wouldn't. Loosen when a
  // non-North-American group is added.
  it("every stop's coordinates are within plausible North America bounds", () => {
    for (const route of PRESET_LINES) {
      for (const stop of route.stops) {
        expect(stop.lng).toBeGreaterThan(-170);
        expect(stop.lng).toBeLessThan(-50);
        expect(stop.lat).toBeGreaterThan(15);
        expect(stop.lat).toBeLessThan(72);
      }
    }
  });

  it("every referenced groupId exists in the group registry", () => {
    const groupIds = new Set(PRESET_GROUPS.map((g) => g.id));
    for (const route of PRESET_LINES) {
      if (route.groupId) {
        expect(groupIds.has(route.groupId)).toBe(true);
      }
    }
  });

  it("every color, if present, is a valid hex code", () => {
    for (const route of PRESET_LINES) {
      if (route.color) {
        expect(route.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("ships the UCAT bus network, all typed as buses", () => {
    const ucat = PRESET_LINES.filter((l) => l.groupId === "ucat");
    expect(ucat.length).toBeGreaterThanOrEqual(10);
    for (const route of ucat) {
      expect(route.routeType).toBe("bus");
    }
  });
});

describe("PRESET_GROUPS", () => {
  it("has unique ids", () => {
    const ids = PRESET_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
