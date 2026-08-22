import { parse } from "csv-parse/sync";
import { unzipSync, strFromU8 } from "fflate";

/**
 * The subset of GTFS tables the catalog transform reads. Each is an array of
 * raw string-keyed rows (GTFS is all-strings on the wire); the transform coerces
 * the few numeric fields it needs. Only files we consume are parsed; a feed's
 * calendar/fares/shapes/etc. are ignored.
 */
export type GtfsTables = {
  agency: GtfsRow[];
  routes: GtfsRow[];
  trips: GtfsRow[];
  stops: GtfsRow[];
  stopTimes: GtfsRow[];
};

export type GtfsRow = Record<string, string>;

const FILES: Record<keyof GtfsTables, string> = {
  agency: "agency.txt",
  routes: "routes.txt",
  trips: "trips.txt",
  stops: "stops.txt",
  stopTimes: "stop_times.txt",
};

/** GTFS allows an optional UTF-8 BOM on any file; strip it so the first header parses. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsv(text: string): GtfsRow[] {
  return parse(stripBom(text), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as GtfsRow[];
}

/**
 * Unzip a GTFS archive (as bytes) and parse the tables the transform needs.
 * Filenames are matched case-insensitively and ignore any folder nesting some
 * publishers add. A missing required file throws; `stop_times.txt` and the rest
 * must be present for a feed to yield routes.
 */
export function parseGtfsZip(zip: Uint8Array): GtfsTables {
  const entries = unzipSync(zip);
  const byBasename = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(entries)) {
    const base = path.split("/").pop()?.toLowerCase();
    if (base) {
      byBasename.set(base, bytes);
    }
  }

  const read = (file: string): GtfsRow[] => {
    const bytes = byBasename.get(file.toLowerCase());
    if (!bytes) {
      throw new Error(`GTFS feed is missing ${file}`);
    }
    return parseCsv(strFromU8(bytes));
  };

  return {
    agency: read(FILES.agency),
    routes: read(FILES.routes),
    trips: read(FILES.trips),
    stops: read(FILES.stops),
    stopTimes: read(FILES.stopTimes),
  };
}
