import type { PresetGroup, PresetPattern, PresetRoute, PresetStop } from "../lib/presets";
import type { RouteType } from "../lib/types";
import type { GtfsRow, GtfsTables } from "./parse";
import { routeTypeFromGtfs } from "./routeType";

/** A catalog fragment for one feed — combined with others by the assembler. */
export type CatalogFragment = {
  groups: PresetGroup[];
  stops: PresetStop[];
  routes: PresetRoute[];
};

export type TransformOptions = {
  /**
   * Namespaces every emitted id (stop, route, pattern, group). GTFS ids are only
   * unique within a feed, so combining feeds needs a per-feed prefix to avoid
   * `stop_id` collisions between agencies.
   */
  idPrefix?: string;
  /**
   * Cap on distinct patterns kept per route, most-frequent first. Real routes can
   * have dozens of short-turn variants; the picker only needs the representative
   * few. Defaults to 6.
   */
  maxPatternsPerRoute?: number;
  /**
   * Override the GTFS `route_type` → {@link RouteType} mapping for a specific feed
   * — e.g. promote a named intercity line to `hsr`, which the basic GTFS code
   * space can't express. Return `null` to drop a route, `undefined` to fall back
   * to the standard mapping.
   */
  resolveRouteType?: (gtfsRouteType: number, route: GtfsRow) => RouteType | null | undefined;
};

const DEFAULT_MAX_PATTERNS = 6;

function toNumber(value: string | undefined): number {
  return value === undefined || value === "" ? Number.NaN : Number(value);
}

/** Normalize a GTFS `route_color` (6 hex chars, no `#`) into the catalog's `#rrggbb`. */
function normalizeColor(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  return /^[0-9A-Fa-f]{6}$/.test(hex) ? `#${hex.toLowerCase()}` : undefined;
}

type Sequence = { stopIds: string[]; headsign: string; count: number };

/** Group a route's trips into distinct stop sequences, merging opposite directions. */
function distinctSequences(
  tripIds: string[],
  seqByTrip: Map<string, string[]>,
  headsignByTrip: Map<string, string>
): Sequence[] {
  const byKey = new Map<string, Sequence>();
  for (const tripId of tripIds) {
    const stopIds = seqByTrip.get(tripId);
    if (!stopIds || stopIds.length < 2) {
      continue;
    }
    const forward = stopIds.join(">");
    const backward = [...stopIds].reverse().join(">");
    // A pattern and its exact reverse are the same physical line — collapse the
    // two directions onto one canonical key so trip counts sum and the picker
    // isn't offered "X" and "X backwards".
    const key = forward <= backward ? forward : backward;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, { stopIds, headsign: headsignByTrip.get(tripId) ?? "", count: 1 });
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || b.stopIds.length - a.stopIds.length);
}

/**
 * Transform a parsed GTFS feed into a normalized catalog fragment: agencies
 * become groups, `route_type` maps to the editor's mode (routes it can't type
 * are dropped), and each route's trips collapse to representative patterns over a
 * shared, pruned stop table. Only stops reached by a kept pattern are emitted.
 */
export function transformGtfs(tables: GtfsTables, options: TransformOptions = {}): CatalogFragment {
  const { idPrefix, maxPatternsPerRoute = DEFAULT_MAX_PATTERNS, resolveRouteType } = options;
  const nsid = (raw: string): string => (idPrefix ? `${idPrefix}:${raw}` : raw);

  // stop_id → coords/name, valid coordinates only.
  const rawStops = new Map<string, { name: string; lng: number; lat: number }>();
  for (const stop of tables.stops) {
    const lng = toNumber(stop.stop_lon);
    const lat = toNumber(stop.stop_lat);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      rawStops.set(stop.stop_id, { name: stop.stop_name ?? stop.stop_id, lng, lat });
    }
  }

  // trip_id → ordered stop_ids (by stop_sequence).
  const stopTimesByTrip = new Map<string, { seq: number; stopId: string }[]>();
  for (const st of tables.stopTimes) {
    const bucket = stopTimesByTrip.get(st.trip_id) ?? [];
    bucket.push({ seq: toNumber(st.stop_sequence), stopId: st.stop_id });
    stopTimesByTrip.set(st.trip_id, bucket);
  }
  const seqByTrip = new Map<string, string[]>();
  for (const [tripId, times] of stopTimesByTrip) {
    const ordered = times
      .sort((a, b) => a.seq - b.seq)
      .map((t) => t.stopId)
      .filter((id) => rawStops.has(id));
    seqByTrip.set(tripId, ordered);
  }

  // route_id → trip_ids, and trip_id → headsign.
  const tripsByRoute = new Map<string, string[]>();
  const headsignByTrip = new Map<string, string>();
  for (const trip of tables.trips) {
    const bucket = tripsByRoute.get(trip.route_id) ?? [];
    bucket.push(trip.trip_id);
    tripsByRoute.set(trip.route_id, bucket);
    if (trip.trip_headsign) {
      headsignByTrip.set(trip.trip_id, trip.trip_headsign);
    }
  }

  // Agencies → potential groups (kept only if a surviving route references them).
  const agencyNames = new Map<string, string>();
  for (const agency of tables.agency) {
    agencyNames.set(agency.agency_id ?? "", agency.agency_name ?? "Transit");
  }
  const soleAgencyId = tables.agency.length === 1 ? (tables.agency[0].agency_id ?? "") : null;

  const usedStopIds = new Set<string>();
  const usedGroupTypes = new Map<string, RouteType[]>();
  const routes: PresetRoute[] = [];

  for (const route of tables.routes) {
    const gtfsType = toNumber(route.route_type);
    const overridden = resolveRouteType?.(gtfsType, route);
    const routeType = overridden === undefined ? routeTypeFromGtfs(gtfsType) : overridden;
    if (routeType === null) {
      continue; // A mode the editor has no home for — drop the route.
    }

    const sequences = distinctSequences(
      tripsByRoute.get(route.route_id) ?? [],
      seqByTrip,
      headsignByTrip
    ).slice(0, maxPatternsPerRoute);
    if (sequences.length === 0) {
      continue; // No trip with ≥2 real stops — nothing to add to a map.
    }

    const patterns: PresetPattern[] = sequences.map((sequence, index) => {
      for (const stopId of sequence.stopIds) {
        usedStopIds.add(stopId);
      }
      return {
        id: nsid(`${route.route_id}:p${index}`),
        ...(sequence.headsign ? { name: sequence.headsign } : {}),
        stopIds: sequence.stopIds.map(nsid),
      };
    });

    const agencyId = route.agency_id || soleAgencyId || "";
    const groupId = agencyNames.has(agencyId) ? nsid(agencyId || "agency") : undefined;
    if (groupId) {
      usedGroupTypes.set(groupId, [...(usedGroupTypes.get(groupId) ?? []), routeType]);
    }

    routes.push({
      id: nsid(route.route_id),
      name: route.route_long_name || route.route_short_name || route.route_id,
      ...(normalizeColor(route.route_color) ? { color: normalizeColor(route.route_color) } : {}),
      routeType,
      ...(groupId ? { groupId } : {}),
      patterns,
    });
  }

  const stops: PresetStop[] = [...usedStopIds].map((stopId) => {
    const stop = rawStops.get(stopId)!;
    return { id: nsid(stopId), name: stop.name, lng: stop.lng, lat: stop.lat };
  });

  const groups: PresetGroup[] = [...usedGroupTypes.keys()].map((groupId) => {
    const rawAgencyId = idPrefix ? groupId.slice(idPrefix.length + 1) : groupId;
    const name = agencyNames.get(rawAgencyId === "agency" ? "" : rawAgencyId) ?? "Transit";
    return { id: groupId, name, defaultRouteType: mostCommon(usedGroupTypes.get(groupId)!) };
  });

  return { groups, stops, routes };
}

function mostCommon(types: RouteType[]): RouteType {
  const counts = new Map<RouteType, number>();
  for (const type of types) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
