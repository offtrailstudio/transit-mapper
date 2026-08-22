import { afterEach, describe, expect, it, vi } from "vitest";
import { ROUTE_CATALOG_SCHEMA_VERSION, resolveCatalogRoute, validateRouteCatalog } from "./catalog";
import { BUNDLED_ROUTE_CATALOG, remoteRouteSource } from "./index";

const VALID = {
  schemaVersion: ROUTE_CATALOG_SCHEMA_VERSION,
  groups: [{ id: "amtrak", name: "Amtrak" }],
  stops: [
    { id: "s1", name: "A", lng: -73, lat: 41 },
    { id: "s2", name: "B", lng: -74, lat: 42 },
  ],
  routes: [
    {
      id: "r1",
      name: "Route 1",
      groupId: "amtrak",
      patterns: [{ id: "r1:p0", stopIds: ["s1", "s2"] }],
    },
  ],
};

describe("validateRouteCatalog", () => {
  it("accepts a well-formed v2 catalog and returns it typed", () => {
    expect(validateRouteCatalog(VALID)).toBe(VALID);
    expect(validateRouteCatalog(BUNDLED_ROUTE_CATALOG)).toBe(BUNDLED_ROUTE_CATALOG);
  });

  it("rejects a mismatched schemaVersion", () => {
    expect(() => validateRouteCatalog({ ...VALID, schemaVersion: 999 })).toThrow(/schemaVersion/);
  });

  it("rejects non-object payloads", () => {
    expect(() => validateRouteCatalog(null)).toThrow();
    expect(() => validateRouteCatalog("nope")).toThrow();
  });

  it("rejects missing groups/stops/routes arrays", () => {
    expect(() => validateRouteCatalog({ schemaVersion: ROUTE_CATALOG_SCHEMA_VERSION })).toThrow(/arrays/);
  });

  it("accepts optional version + generatedAt metadata", () => {
    const withMeta = { ...VALID, version: "2.0.0", generatedAt: "2026-08-20T00:00:00.000Z" };
    expect(validateRouteCatalog(withMeta)).toBe(withMeta);
  });

  it("rejects non-string version metadata", () => {
    expect(() => validateRouteCatalog({ ...VALID, version: 14 })).toThrow(/version/);
  });

  it("rejects a pattern with fewer than 2 stops", () => {
    const bad = {
      ...VALID,
      routes: [{ ...VALID.routes[0], patterns: [{ id: "r1:p0", stopIds: ["s1"] }] }],
    };
    expect(() => validateRouteCatalog(bad)).toThrow(/at least 2 stops/);
  });

  it("rejects a route with no patterns", () => {
    const bad = { ...VALID, routes: [{ ...VALID.routes[0], patterns: [] }] };
    expect(() => validateRouteCatalog(bad)).toThrow(/at least 1 pattern/);
  });

  it("rejects a pattern referencing a stop not in the table", () => {
    const bad = {
      ...VALID,
      routes: [{ ...VALID.routes[0], patterns: [{ id: "r1:p0", stopIds: ["s1", "ghost"] }] }],
    };
    expect(() => validateRouteCatalog(bad)).toThrow(/unknown stop "ghost"/);
  });

  it("rejects a routeType the editor doesn't understand", () => {
    const bad = { ...VALID, routes: [{ ...VALID.routes[0], routeType: "monorail" }] };
    expect(() => validateRouteCatalog(bad)).toThrow(/not a known transit mode/);
  });

  it("rejects a group defaultRouteType the editor doesn't understand", () => {
    const bad = {
      ...VALID,
      groups: [{ id: "amtrak", name: "Amtrak", defaultRouteType: "spaceship" }],
    };
    expect(() => validateRouteCatalog(bad)).toThrow(/not a known transit mode/);
  });

  it("accepts every known transit mode", () => {
    const withMode = (routeType: string) => ({
      ...VALID,
      routes: [{ ...VALID.routes[0], routeType }],
    });
    for (const mode of ["bus", "tram", "subway", "ferry", "rail", "hsr"]) {
      expect(() => validateRouteCatalog(withMode(mode))).not.toThrow();
    }
  });

  it("rejects a stop with a non-numeric coordinate", () => {
    const bad = {
      ...VALID,
      stops: [
        { id: "s1", name: "A", lng: "west", lat: 41 },
        { id: "s2", name: "B", lng: -74, lat: 42 },
      ],
    };
    expect(() => validateRouteCatalog(bad)).toThrow(/name\/lng\/lat/);
  });
});

describe("validateRouteCatalog (v1 upgrade)", () => {
  const V1 = {
    schemaVersion: 1,
    groups: [{ id: "amtrak", name: "Amtrak" }],
    routes: [
      {
        id: "r1",
        name: "Route 1",
        groupId: "amtrak",
        routeType: "rail",
        stops: [
          { name: "A", lng: -73, lat: 41 },
          { name: "B", lng: -74, lat: 42 },
        ],
      },
    ],
  };

  it("upgrades a schemaVersion-1 catalog into the normalized v2 shape", () => {
    const upgraded = validateRouteCatalog(V1);
    expect(upgraded.schemaVersion).toBe(ROUTE_CATALOG_SCHEMA_VERSION);
    expect(upgraded.stops).toEqual([
      { id: "r1:0", name: "A", lng: -73, lat: 41 },
      { id: "r1:1", name: "B", lng: -74, lat: 42 },
    ]);
    expect(upgraded.routes[0].patterns).toEqual([{ id: "r1:p0", stopIds: ["r1:0", "r1:1"] }]);
    expect(upgraded.routes[0].routeType).toBe("rail");
  });

  it("still applies v1 field validation before upgrading", () => {
    const bad = { ...V1, routes: [{ ...V1.routes[0], stops: [{ name: "A", lng: -73, lat: 41 }] }] };
    expect(() => validateRouteCatalog(bad)).toThrow(/at least 2 stops/);
  });
});

describe("resolveCatalogRoute", () => {
  it("flattens a route's primary pattern against the stop table, in order", () => {
    const [route] = validateRouteCatalog(VALID).routes;
    const resolved = resolveCatalogRoute(VALID, route);
    expect(resolved.stops.map((s) => s.name)).toEqual(["A", "B"]);
    expect(resolved.groupId).toBe("amtrak");
    expect("patterns" in resolved).toBe(false);
  });
});

describe("remoteRouteSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches, validates, and searches the hosted catalog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => VALID }))
    );
    const results = await remoteRouteSource("https://cdn.example/routes.json").search("");
    expect(results.map((r) => r.id)).toEqual(["r1"]);
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, statusText: "Not Found" }))
    );
    await expect(remoteRouteSource("https://cdn.example/routes.json").search("")).rejects.toThrow(
      /404/
    );
  });

  it("throws when the fetched payload fails validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ schemaVersion: 999 }) }))
    );
    await expect(remoteRouteSource("https://cdn.example/routes.json").search("")).rejects.toThrow(
      /schemaVersion/
    );
  });
});
