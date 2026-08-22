import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseGtfsZip } from "./parse";

function gtfsZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] = strToU8(content);
  }
  return zipSync(entries);
}

const MINIMAL = {
  "agency.txt": "agency_id,agency_name\nMTA,Metro Transit\n",
  "routes.txt": "route_id,route_type,route_long_name\nR1,2,Harlem Line\n",
  "trips.txt": "route_id,trip_id\nR1,T1\n",
  "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\nS1,Grand Central,40.752,-73.977\n",
  "stop_times.txt": "trip_id,stop_id,stop_sequence\nT1,S1,1\n",
};

describe("parseGtfsZip", () => {
  it("unzips and parses the required tables into rows", () => {
    const tables = parseGtfsZip(gtfsZip(MINIMAL));
    expect(tables.agency).toEqual([{ agency_id: "MTA", agency_name: "Metro Transit" }]);
    expect(tables.routes[0]).toMatchObject({ route_id: "R1", route_type: "2" });
    expect(tables.stops[0]).toMatchObject({ stop_id: "S1", stop_lat: "40.752" });
  });

  it("matches filenames case-insensitively and ignores folder nesting", () => {
    const nested: Record<string, string> = {};
    for (const [name, content] of Object.entries(MINIMAL)) {
      nested[`feed/${name.toUpperCase()}`] = content;
    }
    const tables = parseGtfsZip(gtfsZip(nested));
    expect(tables.agency[0].agency_name).toBe("Metro Transit");
  });

  it("strips a UTF-8 BOM so the first header still parses", () => {
    const withBom = { ...MINIMAL, "agency.txt": "﻿agency_id,agency_name\nMTA,Metro Transit\n" };
    const tables = parseGtfsZip(gtfsZip(withBom));
    expect(tables.agency[0].agency_id).toBe("MTA");
  });

  it("throws a descriptive error when a required file is missing", () => {
    const { ["stops.txt"]: _omit, ...rest } = MINIMAL;
    expect(() => parseGtfsZip(gtfsZip(rest))).toThrow(/missing stops.txt/);
  });
});
