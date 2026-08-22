import { ROUTE_TYPES } from "../lineKinds";
import { PresetGroup, PresetRoute, PresetStop, PRESET_SCHEMA_VERSION } from "./types";
import { upgradeLegacyCatalog, validateLegacyCatalog } from "./legacy";

export { PRESET_SCHEMA_VERSION };

/**
 * A self-contained, normalized snapshot of the preset catalog — what the "Add a
 * preset route" modal renders, and a strict projection of the editor's own
 * {@link import("../types").TransitMapData}: a shared `stops` table plus `routes`
 * whose ordered sequences live in `patterns`. Bundling this into the editor
 * couples data churn (new networks, moved stops) to code releases, so the editor
 * treats it as *injected*: the host passes a catalog (or a loader that fetches
 * one) and updates it without shipping a new package. `schemaVersion` lets the
 * editor reject — or, for the previous shape, upgrade — a payload it's handed.
 */
export type PresetCatalog = {
  schemaVersion: number;
  /**
   * Semver of the *content* (distinct from `schemaVersion`, which versions the
   * shape). Patch = coordinate fixes, minor = new routes/networks, major = a
   * schema bump. Publish-time metadata — the bundled default omits it.
   */
  version?: string;
  /** ISO-8601 timestamp of when this snapshot was built. Publish-time metadata. */
  generatedAt?: string;
  groups: PresetGroup[];
  /** Shared stop table (GTFS `stops.txt`); patterns reference these by id. */
  stops: PresetStop[];
  routes: PresetRoute[];
};

/**
 * The small companion file published next to a catalog so a pinned consumer can
 * *detect* (not silently apply) that a newer catalog exists and surface it.
 */
export type PresetManifest = {
  latestVersion: string;
  schemaVersion: number;
  publishedAt: string;
  summary: string;
  url: string;
};

/**
 * How the host supplies the catalog: an in-memory object, or a (possibly async)
 * loader called lazily the first time the modal opens. Read once — like
 * `MapDataProvider`'s `loadInitial`, its identity needn't be stable.
 */
export type PresetSource = PresetCatalog | (() => PresetCatalog | Promise<PresetCatalog>);

/**
 * A route flattened for *application to a map*: its primary pattern resolved
 * against the catalog's stop table into an ordered, inline stop list. The picker
 * and reducer work on this — a route is added as a single sequence of stations,
 * matching the platform's "editing targets the first pattern" convention.
 */
export type ResolvedPresetRoute = {
  id: string;
  name: string;
  color?: string;
  routeType?: import("../types").RouteType;
  description?: string;
  groupId?: string;
  stops: PresetStop[];
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

function validateV2(catalog: Record<string, unknown>): PresetCatalog {
  if (catalog.version !== undefined && typeof catalog.version !== "string") {
    throw new Error("Preset catalog `version`, if present, must be a string");
  }
  if (catalog.generatedAt !== undefined && typeof catalog.generatedAt !== "string") {
    throw new Error("Preset catalog `generatedAt`, if present, must be a string");
  }
  if (
    !Array.isArray(catalog.groups) ||
    !Array.isArray(catalog.stops) ||
    !Array.isArray(catalog.routes)
  ) {
    throw new Error("Preset catalog needs `groups`, `stops`, and `routes` arrays");
  }

  const stopIds = new Set<string>();
  for (const stop of catalog.stops) {
    const s = stop as Record<string, unknown>;
    if (typeof s?.id !== "string") {
      throw new Error("Each preset stop needs a string `id`");
    }
    if (typeof s.name !== "string" || typeof s.lng !== "number" || typeof s.lat !== "number") {
      throw new Error(`Preset stop "${s.id}" is missing name/lng/lat`);
    }
    stopIds.add(s.id);
  }

  for (const group of catalog.groups) {
    const g = group as Record<string, unknown>;
    if (typeof g?.id !== "string" || typeof g?.name !== "string") {
      throw new Error("Each preset group needs a string `id` and `name`");
    }
    assertRouteType(g.defaultRouteType, `group "${g.id}" defaultRouteType`);
  }

  for (const route of catalog.routes) {
    const r = route as Record<string, unknown>;
    if (typeof r?.id !== "string" || typeof r?.name !== "string") {
      throw new Error("Each preset route needs a string `id` and `name`");
    }
    assertRouteType(r.routeType, `route "${r.id}" routeType`);
    if (!Array.isArray(r.patterns) || r.patterns.length < 1) {
      throw new Error(`Preset route "${r.id}" needs at least 1 pattern`);
    }
    for (const pattern of r.patterns) {
      const p = pattern as Record<string, unknown>;
      if (typeof p?.id !== "string") {
        throw new Error(`Preset route "${r.id}" has a pattern missing a string \`id\``);
      }
      if (!Array.isArray(p.stopIds) || p.stopIds.length < 2) {
        throw new Error(`Preset route "${r.id}" pattern "${p.id}" needs at least 2 stops`);
      }
      for (const stopId of p.stopIds) {
        if (typeof stopId !== "string" || !stopIds.has(stopId)) {
          throw new Error(
            `Preset route "${r.id}" pattern "${p.id}" references unknown stop "${String(stopId)}"`
          );
        }
      }
    }
  }

  return catalog as unknown as PresetCatalog;
}

/**
 * Validate an untrusted payload (e.g. parsed remote JSON) into a v2
 * {@link PresetCatalog}, throwing a descriptive error on anything malformed. A
 * schemaVersion-1 payload is validated in its old shape and *upgraded* to v2, so
 * a catalog pinned before the schema bump keeps loading. Any other version is
 * rejected rather than silently breaking the editor.
 */
export function validatePresetCatalog(raw: unknown): PresetCatalog {
  if (!raw || typeof raw !== "object") {
    throw new Error("Preset catalog must be an object");
  }
  const catalog = raw as Record<string, unknown>;
  if (catalog.schemaVersion === 1) {
    return upgradeLegacyCatalog(validateLegacyCatalog(catalog));
  }
  if (catalog.schemaVersion === PRESET_SCHEMA_VERSION) {
    return validateV2(catalog);
  }
  throw new Error(
    `Unsupported preset schemaVersion ${String(catalog.schemaVersion)}; expected ${PRESET_SCHEMA_VERSION}`
  );
}

/**
 * Flatten a catalog route's primary pattern into an ordered, inline stop list —
 * the form the picker and reducer add to a map. Stop ids the table doesn't
 * contain are dropped (the validator guarantees they don't exist post-load).
 */
export function resolvePresetRoute(catalog: PresetCatalog, route: PresetRoute): ResolvedPresetRoute {
  const byId = new Map(catalog.stops.map((stop) => [stop.id, stop]));
  const primary = route.patterns[0];
  const stops = (primary?.stopIds ?? [])
    .map((id) => byId.get(id))
    .filter((stop): stop is PresetStop => stop !== undefined);
  const { patterns: _patterns, ...rest } = route;
  return { ...rest, stops };
}

/**
 * A loader that fetches the catalog as JSON from `url` and validates it — the
 * intended production path, so route edits become a redeploy of a hosted file
 * rather than a package release. Pass to `MapDataProvider`'s `presets` prop.
 */
export function createRemotePresetLoader(
  url: string,
  init?: RequestInit
): () => Promise<PresetCatalog> {
  return async () => {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(`Failed to load presets (${res.status} ${res.statusText})`);
    }
    return validatePresetCatalog(await res.json());
  };
}
