import { describe, expect, it, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { createMobilityDatabaseHandler } from "./handler";
import type { ResolvedRoute, RouteSummary } from "../lib/presets";

function gtfsZip(): Uint8Array {
  return zipSync({
    "agency.txt": strToU8("agency_id,agency_name\nAMTK,Amtrak\n"),
    "routes.txt": strToU8("route_id,route_type,route_long_name\nNER,2,Northeast Regional\n"),
    "trips.txt": strToU8("route_id,trip_id\nNER,t1\n"),
    "stops.txt": strToU8(
      "stop_id,stop_name,stop_lat,stop_lon\nBOS,Boston,42.35,-71.05\nNYP,New York,40.75,-73.99\n"
    ),
    "stop_times.txt": strToU8("trip_id,stop_id,stop_sequence\nt1,BOS,1\nt1,NYP,2\n"),
  });
}

function ok(body: unknown): Response {
  return { ok: true, status: 200, statusText: "OK", json: async () => body } as unknown as Response;
}

function mockFetch(zip: Uint8Array) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/tokens/access")) return ok({ access_token: "tok" });
    if (url.includes("/gtfs_feeds?provider=")) {
      return ok([{ id: "mdb-1", provider: "Amtrak", latest_dataset: { hosted_url: "https://host/f.zip" } }]);
    }
    if (url === "https://host/f.zip") {
      return { ok: true, status: 200, statusText: "OK", arrayBuffer: async () => zip.buffer } as unknown as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const handler = (fetchImpl: ReturnType<typeof mockFetch>) =>
  createMobilityDatabaseHandler({ refreshToken: "r", fetchImpl: fetchImpl as unknown as typeof fetch });

describe("createMobilityDatabaseHandler", () => {
  it("search returns a matched network's routes", async () => {
    const h = handler(mockFetch(gtfsZip()));
    const res = await h(new Request("https://x/api?op=search&q=Amtrak"));
    const summaries = (await res.json()) as RouteSummary[];
    expect(summaries.map((s) => s.id)).toEqual(["mdb-1:NER"]);
    expect(summaries[0]).toMatchObject({ name: "Northeast Regional", networkName: "Amtrak", mode: "rail" });
  });

  it("resolve returns the route's ordered stops (reusing the cached feed)", async () => {
    const fetchImpl = mockFetch(gtfsZip());
    const h = handler(fetchImpl);
    await h(new Request("https://x/api?op=search&q=Amtrak"));
    const downloads = fetchImpl.mock.calls.filter(([u]) => String(u) === "https://host/f.zip").length;

    const res = await h(new Request("https://x/api?op=resolve&id=mdb-1:NER"));
    const route = (await res.json()) as ResolvedRoute;
    expect(route.stops.map((s) => s.name)).toEqual(["Boston", "New York"]);
    // The feed was parsed once and cached across search + resolve.
    expect(fetchImpl.mock.calls.filter(([u]) => String(u) === "https://host/f.zip").length).toBe(downloads);
  });

  it("returns 400 for an unknown op", async () => {
    const res = await handler(mockFetch(gtfsZip()))(new Request("https://x/api?op=bogus"));
    expect(res.status).toBe(400);
  });

  it("returns 502 with a message when the upstream fails", async () => {
    const failing = vi.fn(async () => ({ ok: false, status: 500, statusText: "Server Error" }) as Response);
    const res = await createMobilityDatabaseHandler({
      refreshToken: "r",
      fetchImpl: failing as unknown as typeof fetch,
    })(new Request("https://x/api?op=search&q=Amtrak"));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/token exchange|failed/i);
  });
});
