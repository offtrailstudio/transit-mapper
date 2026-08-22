import { afterEach, describe, expect, it, vi } from "vitest";
import { mobilityDatabaseRouteSource, staticRouteSource } from "./routeSource";
import { RouteCatalog } from "./catalog";

const CATALOG: RouteCatalog = {
  schemaVersion: 2,
  groups: [{ id: "amtrak", name: "Amtrak", defaultRouteType: "rail" }],
  stops: [
    { id: "s1", name: "Boston", lng: -71, lat: 42 },
    { id: "s2", name: "New York", lng: -74, lat: 40 },
  ],
  routes: [
    { id: "ner", name: "Northeast Regional", groupId: "amtrak", patterns: [{ id: "p", stopIds: ["s1", "s2"] }] },
  ],
};

describe("staticRouteSource", () => {
  it("searches by name/network and resolves stops with the resolved mode", async () => {
    const source = staticRouteSource(CATALOG);
    expect((await source.search("regional")).map((s) => s.id)).toEqual(["ner"]);
    expect((await source.search("amtrak")).map((s) => s.id)).toEqual(["ner"]);
    expect(await source.search("nope")).toEqual([]);

    const route = await source.resolve("ner");
    expect(route.routeType).toBe("rail"); // from the network default
    expect(route.stops.map((s) => s.name)).toEqual(["Boston", "New York"]);
  });
});

describe("mobilityDatabaseRouteSource", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls the endpoint with op=search and returns the summaries", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [{ id: "mdb-1:NER", name: "Northeast Regional" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await mobilityDatabaseRouteSource({ endpoint: "/api/routes" }).search("Amtrak");

    expect(results[0].id).toBe("mdb-1:NER");
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("op=search");
    expect(calledUrl).toContain("q=Amtrak");
  });

  it("resolve hits op=resolve and returns the route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ id: "mdb-1:NER", name: "NER", stops: [] }) }))
    );
    const route = await mobilityDatabaseRouteSource({ endpoint: "/api/routes" }).resolve("mdb-1:NER");
    expect(route.name).toBe("NER");
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, statusText: "err" })));
    await expect(
      mobilityDatabaseRouteSource({ endpoint: "/api/routes" }).search("x")
    ).rejects.toThrow(/500/);
  });
});
