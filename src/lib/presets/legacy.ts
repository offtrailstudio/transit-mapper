import { ROUTE_TYPES } from "../lineKinds";
import { RouteType } from "../types";
import { PresetGroup, PresetRoute, PresetStop, PRESET_SCHEMA_VERSION } from "./types";
import type { PresetCatalog } from "./catalog";

/**
 * The flat, denormalized authoring shape that predates the normalized v2 catalog
 * (schemaVersion 1): stops are embedded on each route instead of living in a
 * shared table, and a route carries a single stop list rather than named
 * patterns. It's ergonomic to hand-write, so it survives as the *authoring*
 * format for the bundled fallback — {@link upgradeLegacyCatalog} lifts it to v2.
 */
export type LegacyPresetStop = { name: string; lng: number; lat: number };

export type LegacyPresetRoute = {
  id: string;
  name: string;
  color?: string;
  routeType?: RouteType;
  description?: string;
  groupId?: string;
  stops: LegacyPresetStop[];
};

export type LegacyPresetCatalog = {
  groups: PresetGroup[];
  routes: LegacyPresetRoute[];
};

function assertRouteType(value: unknown, label: string): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "string" || !(ROUTE_TYPES as readonly string[]).includes(value)) {
    throw new Error(
      `Preset ${label} "${String(value)}" is not a known transit mode (${ROUTE_TYPES.join(", ")})`
    );
  }
}

/**
 * Validate an untrusted schemaVersion-1 payload into a {@link LegacyPresetCatalog}.
 * Kept so a v1 catalog pinned by a host still loads: the validator upgrades it to
 * v2 after these checks pass.
 */
export function validateLegacyCatalog(raw: Record<string, unknown>): LegacyPresetCatalog {
  if (!Array.isArray(raw.groups) || !Array.isArray(raw.routes)) {
    throw new Error("Preset catalog needs `groups` and `routes` arrays");
  }
  for (const group of raw.groups) {
    const g = group as Record<string, unknown>;
    if (typeof g?.id !== "string" || typeof g?.name !== "string") {
      throw new Error("Each preset group needs a string `id` and `name`");
    }
    assertRouteType(g.defaultRouteType, `group "${g.id}" defaultRouteType`);
  }
  for (const route of raw.routes) {
    const r = route as Record<string, unknown>;
    if (typeof r?.id !== "string" || typeof r?.name !== "string") {
      throw new Error("Each preset route needs a string `id` and `name`");
    }
    assertRouteType(r.routeType, `route "${r.id}" routeType`);
    if (!Array.isArray(r.stops) || r.stops.length < 2) {
      throw new Error(`Preset route "${String(r.id ?? "?")}" needs at least 2 stops`);
    }
    for (const stop of r.stops) {
      const s = stop as Record<string, unknown>;
      if (typeof s?.name !== "string" || typeof s?.lng !== "number" || typeof s?.lat !== "number") {
        throw new Error(`Preset route "${r.id}" has a stop missing name/lng/lat`);
      }
    }
  }
  return raw as unknown as LegacyPresetCatalog;
}

/**
 * Lift the flat legacy shape into a normalized v2 catalog: each legacy stop
 * becomes a `PresetStop` in the shared table (id = `${routeId}:${index}`, so the
 * build is deterministic and reproducible) and each route gets a single primary
 * pattern referencing those ids. Deliberately does *no* cross-route dedup —
 * identity-based sharing is a property of authoritative GTFS `stop_id`s, not
 * something to infer from coordinates here; the runtime still proximity-merges
 * against the user's own map when a legacy-derived route is added.
 */
export function upgradeLegacyCatalog(legacy: LegacyPresetCatalog): PresetCatalog {
  const stops: PresetStop[] = [];
  const routes = legacy.routes.map((route) => {
    const stopIds = route.stops.map((stop, index) => {
      const id = `${route.id}:${index}`;
      stops.push({ id, name: stop.name, lng: stop.lng, lat: stop.lat });
      return id;
    });
    const { stops: _stops, ...rest } = route;
    return { ...rest, patterns: [{ id: `${route.id}:p0`, stopIds }] } satisfies PresetRoute;
  });

  return {
    schemaVersion: PRESET_SCHEMA_VERSION,
    groups: legacy.groups,
    stops,
    routes,
  };
}
