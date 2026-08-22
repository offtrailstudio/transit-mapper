import type { RouteType } from "../lib/types";

/**
 * Map a GTFS `route_type` integer onto the editor's coarse {@link RouteType}
 * bucket (which drives simulation speed + the picker's mode label).
 *
 * GTFS has two overlapping code spaces:
 *   - the *basic* types 0–12 from the GTFS Reference, and
 *   - the *extended* "Hierarchical Vehicle Type" (HVT) codes 100–1799 that many
 *     European/aggregated feeds emit (TPEG pti_table_18 lineage).
 * We handle both. The editor only has six modes, so several GTFS distinctions
 * collapse (e.g. every flavour of coach/bus → `bus`).
 *
 * Returns `null` for vehicle classes the editor has no home for (air, taxi,
 * generic "miscellaneous") — the ingest layer skips those routes rather than
 * guessing a mode. High-speed rail is only expressed in the extended space
 * (code 101); a basic `route_type: 2` stays `rail` and can be promoted to `hsr`
 * by a per-feed override upstream, never by this pure mapping.
 */
export function routeTypeFromGtfs(code: number): RouteType | null {
  if (!Number.isInteger(code) || code < 0) {
    return null;
  }

  // Basic GTFS Reference types (0–12).
  switch (code) {
    case 0: // Tram, streetcar, light rail
      return "tram";
    case 1: // Subway, metro
      return "subway";
    case 2: // Rail (intercity / long-distance)
      return "rail";
    case 3: // Bus
      return "bus";
    case 4: // Ferry
      return "ferry";
    case 5: // Cable tram
      return "tram";
    case 6: // Aerial lift, suspended cable car — no editor equivalent
      return null;
    case 7: // Funicular
      return "tram";
    case 11: // Trolleybus
      return "bus";
    case 12: // Monorail (grade-separated rapid transit)
      return "subway";
  }

  // Extended HVT ranges (100–1799): match on the hundreds "family", with a few
  // specific overrides that carry more mode signal than their family.
  if (code === 101) {
    return "hsr"; // High-speed rail service
  }
  const family = Math.floor(code / 100) * 100;
  switch (family) {
    case 100: // Railway service (regional/suburban/long-distance/…)
      return "rail";
    case 200: // Coach service (long-distance bus)
      return "bus";
    case 400: // Urban railway / metro / underground / monorail
      return "subway";
    case 700: // Bus service
      return "bus";
    case 800: // Trolleybus service
      return "bus";
    case 900: // Tram service
      return "tram";
    case 1000: // Water transport service
      return "ferry";
    case 1200: // Ferry service
      return "ferry";
    case 1400: // Funicular service
      return "tram";
    // 1100 air, 1300 aerial lift, 1500 taxi, 1700 misc → no editor equivalent.
    default:
      return null;
  }
}
