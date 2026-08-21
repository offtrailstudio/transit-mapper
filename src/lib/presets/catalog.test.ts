import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRemotePresetLoader,
  PRESET_SCHEMA_VERSION,
  validatePresetCatalog,
} from "./catalog";
import { DEFAULT_PRESET_CATALOG } from "./index";

const VALID = {
  schemaVersion: PRESET_SCHEMA_VERSION,
  groups: [{ id: "amtrak", name: "Amtrak" }],
  routes: [
    {
      id: "r1",
      name: "Route 1",
      groupId: "amtrak",
      stops: [
        { name: "A", lng: -73, lat: 41 },
        { name: "B", lng: -74, lat: 42 },
      ],
    },
  ],
};

describe("validatePresetCatalog", () => {
  it("accepts a well-formed catalog and returns it typed", () => {
    expect(validatePresetCatalog(VALID)).toBe(VALID);
    expect(validatePresetCatalog(DEFAULT_PRESET_CATALOG)).toBe(DEFAULT_PRESET_CATALOG);
  });

  it("rejects a mismatched schemaVersion", () => {
    expect(() => validatePresetCatalog({ ...VALID, schemaVersion: 999 })).toThrow(/schemaVersion/);
  });

  it("rejects non-object payloads", () => {
    expect(() => validatePresetCatalog(null)).toThrow();
    expect(() => validatePresetCatalog("nope")).toThrow();
  });

  it("rejects missing groups/routes arrays", () => {
    expect(() => validatePresetCatalog({ schemaVersion: PRESET_SCHEMA_VERSION })).toThrow(/arrays/);
  });

  it("accepts optional version + generatedAt metadata", () => {
    const withMeta = { ...VALID, version: "1.4.0", generatedAt: "2026-08-20T00:00:00.000Z" };
    expect(validatePresetCatalog(withMeta)).toBe(withMeta);
  });

  it("rejects non-string version metadata", () => {
    expect(() => validatePresetCatalog({ ...VALID, version: 14 })).toThrow(/version/);
  });

  it("rejects a route with fewer than 2 stops", () => {
    const bad = {
      ...VALID,
      routes: [{ id: "r1", name: "Route 1", stops: [{ name: "A", lng: -73, lat: 41 }] }],
    };
    expect(() => validatePresetCatalog(bad)).toThrow(/at least 2 stops/);
  });

  it("rejects a routeType the editor doesn't understand", () => {
    const bad = {
      ...VALID,
      routes: [{ ...VALID.routes[0], routeType: "monorail" }],
    };
    expect(() => validatePresetCatalog(bad)).toThrow(/not a known transit mode/);
  });

  it("rejects a group defaultRouteType the editor doesn't understand", () => {
    const bad = {
      ...VALID,
      groups: [{ id: "amtrak", name: "Amtrak", defaultRouteType: "spaceship" }],
    };
    expect(() => validatePresetCatalog(bad)).toThrow(/not a known transit mode/);
  });

  it("accepts every known transit mode", () => {
    const withMode = (routeType: string) => ({
      ...VALID,
      routes: [{ ...VALID.routes[0], routeType }],
    });
    for (const mode of ["bus", "tram", "subway", "ferry", "rail", "hsr"]) {
      expect(() => validatePresetCatalog(withMode(mode))).not.toThrow();
    }
  });

  it("rejects a stop with a non-numeric coordinate", () => {
    const bad = {
      ...VALID,
      routes: [
        {
          id: "r1",
          name: "Route 1",
          stops: [
            { name: "A", lng: "west", lat: 41 },
            { name: "B", lng: -74, lat: 42 },
          ],
        },
      ],
    };
    expect(() => validatePresetCatalog(bad)).toThrow(/lng\/lat/);
  });
});

describe("createRemotePresetLoader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches, validates, and returns the catalog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => VALID }))
    );
    const load = createRemotePresetLoader("https://cdn.example/presets.json");
    await expect(load()).resolves.toBe(VALID);
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, statusText: "Not Found", json: async () => ({}) }))
    );
    const load = createRemotePresetLoader("https://cdn.example/presets.json");
    await expect(load()).rejects.toThrow(/404/);
  });

  it("throws when the fetched payload fails validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ schemaVersion: 2 }) }))
    );
    const load = createRemotePresetLoader("https://cdn.example/presets.json");
    await expect(load()).rejects.toThrow(/schemaVersion/);
  });
});
