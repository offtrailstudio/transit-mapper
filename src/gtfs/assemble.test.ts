import { describe, expect, it, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { assembleCatalog, combineFragments } from "./assemble";
import { pickFeed } from "./mobilityDatabase";

function gtfsZip(): Uint8Array {
  return zipSync({
    "agency.txt": strToU8("agency_id,agency_name\nAMTK,Amtrak\n"),
    "routes.txt": strToU8("route_id,route_type,route_long_name\nNER,2,Northeast Regional\nACE,2,Acela\n"),
    "trips.txt": strToU8("route_id,trip_id\nNER,t1\nACE,t2\n"),
    "stops.txt": strToU8(
      "stop_id,stop_name,stop_lat,stop_lon\nBOS,Boston,42.35,-71.05\nNYP,New York,40.75,-73.99\n"
    ),
    "stop_times.txt": strToU8(
      "trip_id,stop_id,stop_sequence\nt1,BOS,1\nt1,NYP,2\nt2,BOS,1\nt2,NYP,2\n"
    ),
  });
}

function ok(json: unknown): Response {
  return { ok: true, status: 200, statusText: "OK", json: async () => json } as unknown as Response;
}

/** Route a mock fetch by URL through the token → feed-list → download sequence. */
function mockFetch(zip: Uint8Array) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/tokens/access")) {
      return ok({ access_token: "tok", expiration_datetime_utc: "2026-01-01T00:00:00Z" });
    }
    if (url.includes("/gtfs_feeds?provider=")) {
      return ok([{ id: "mdb-1", provider: "Amtrak", latest_dataset: { hosted_url: "https://host/f.zip" } }]);
    }
    if (url === "https://host/f.zip") {
      return { ok: true, status: 200, statusText: "OK", arrayBuffer: async () => zip.buffer } as unknown as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("assembleCatalog", () => {
  it("builds a validated catalog from a live-shaped feed lookup + download", async () => {
    const catalog = await assembleCatalog({
      refreshToken: "refresh",
      networks: [
        {
          idPrefix: "amtrak",
          provider: "Amtrak",
          resolveRouteType: (_t, r) => (/acela/i.test(r.route_long_name ?? "") ? "hsr" : undefined),
        },
      ],
      version: "3.0.0",
      generatedAt: "2026-08-21T00:00:00.000Z",
      fetchImpl: mockFetch(gtfsZip()),
      log: () => {},
    });

    expect(catalog.schemaVersion).toBe(2);
    expect(catalog.version).toBe("3.0.0");
    expect(catalog.groups.map((g) => g.id)).toEqual(["amtrak:AMTK"]);
    expect(catalog.routes.map((r) => r.id).sort()).toEqual(["amtrak:ACE", "amtrak:NER"]);
    expect(catalog.routes.find((r) => r.id === "amtrak:ACE")!.routeType).toBe("hsr");
    expect(catalog.routes.find((r) => r.id === "amtrak:NER")!.routeType).toBe("rail");
    expect(catalog.stops.map((s) => s.id).sort()).toEqual(["amtrak:BOS", "amtrak:NYP"]);
  });

  it("skips (does not crash) a network with no downloadable feed, and logs it", async () => {
    const messages: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/tokens/access")) return ok({ access_token: "tok" });
      if (url.includes("/gtfs_feeds?provider=")) return ok([{ id: "mdb-9", latest_dataset: null }]);
      throw new Error(`unexpected: ${url}`);
    });

    const catalog = await assembleCatalog({
      refreshToken: "r",
      networks: [{ idPrefix: "ghost", provider: "Nowhere Transit" }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      log: (m) => messages.push(m),
    });

    expect(catalog.routes).toHaveLength(0);
    expect(messages.some((m) => m.includes("skip ghost"))).toBe(true);
  });
});

describe("combineFragments", () => {
  it("concatenates routes/stops and dedupes groups by id", () => {
    const combined = combineFragments([
      { groups: [{ id: "a", name: "A" }], stops: [{ id: "s1", name: "S1", lng: 0, lat: 0 }], routes: [] },
      { groups: [{ id: "a", name: "A" }], stops: [{ id: "s2", name: "S2", lng: 1, lat: 1 }], routes: [] },
    ]);
    expect(combined.groups).toHaveLength(1);
    expect(combined.stops.map((s) => s.id)).toEqual(["s1", "s2"]);
  });
});

describe("pickFeed", () => {
  it("returns the first feed with a downloadable dataset, else null", () => {
    expect(pickFeed([{ id: "a", latest_dataset: null }, { id: "b", latest_dataset: { hosted_url: "u" } }])?.id).toBe("b");
    expect(pickFeed([{ id: "a", latest_dataset: null }])).toBeNull();
  });
});
