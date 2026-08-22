import { describe, expect, it, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { fetchGtfsCatalog } from "./fetchCatalog";

function gtfsZip(): Uint8Array {
  return zipSync({
    "agency.txt": strToU8("agency_id,agency_name\nSEPTA,SEPTA\n"),
    "routes.txt": strToU8("route_id,route_type,route_long_name\nWIL,2,Wilmington Line\n"),
    "trips.txt": strToU8("route_id,trip_id\nWIL,t1\n"),
    "stops.txt": strToU8(
      "stop_id,stop_name,stop_lat,stop_lon\nPHL,Philadelphia,39.95,-75.18\nWIL,Wilmington,39.74,-75.55\n"
    ),
    "stop_times.txt": strToU8("trip_id,stop_id,stop_sequence\nt1,PHL,1\nt1,WIL,2\n"),
  });
}

function okZip(zip: Uint8Array): Response {
  return { ok: true, status: 200, statusText: "OK", arrayBuffer: async () => zip.buffer } as unknown as Response;
}

describe("fetchGtfsCatalog", () => {
  it("fetches a zip URL and transforms it into a namespaced fragment", async () => {
    const fetchImpl = vi.fn(async () => okZip(gtfsZip()));
    const fragment = await fetchGtfsCatalog("https://example.com/feed.zip", {
      idPrefix: "pasted-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/feed.zip");
    expect(fragment.groups.map((g) => g.id)).toEqual(["pasted-1:SEPTA"]);
    expect(fragment.routes.map((r) => r.id)).toEqual(["pasted-1:WIL"]);
    expect(fragment.routes[0].name).toBe("Wilmington Line");
    expect(fragment.routes[0].patterns[0].stopIds).toEqual(["pasted-1:PHL", "pasted-1:WIL"]);
  });

  it("propagates a failed download", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404, statusText: "Not Found" }) as Response);
    await expect(
      fetchGtfsCatalog("https://example.com/missing.zip", {
        idPrefix: "pasted-1",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toThrow(/404/);
  });
});
