import { ROUTE_TYPES } from "../lineKinds";
import { PresetGroup, PresetRoute } from "./types";

/**
 * A self-contained snapshot of the preset route catalog — what the "Add a preset
 * route" modal renders. Bundling this into the editor package couples data churn
 * (new networks, moved stops) to code releases, so the editor treats it as
 * *injected* content: the host passes a catalog (or a loader that fetches one)
 * and can update it without shipping a new package version. `schemaVersion` lets
 * the editor reject a payload whose shape it doesn't understand.
 */
export type PresetCatalog = {
  schemaVersion: number;
  /**
   * Semver of the *content* (distinct from `schemaVersion`, which versions the
   * shape). Patch = coordinate fixes, minor = new routes/networks, major = a
   * schema bump. Lets a consumer show "Catalog v1.4.0" and decide whether to move
   * their pin. Publish-time metadata — the bundled default omits it.
   */
  version?: string;
  /** ISO-8601 timestamp of when this snapshot was built. Publish-time metadata. */
  generatedAt?: string;
  groups: PresetGroup[];
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

/** Bump when the catalog shape changes incompatibly; loaders reject other versions. */
export const PRESET_SCHEMA_VERSION = 1;

/**
 * Validate an untrusted payload (e.g. parsed remote JSON) into a `PresetCatalog`,
 * throwing a descriptive error on anything malformed. Keeps a bad coordinate or a
 * stale schema from silently breaking the editor. Returns the same object, typed.
 */
/**
 * A route's transit mode must be one the editor understands — otherwise the
 * picker (and headway lookup) would crash on an unknown key. Optional: an
 * omitted mode is resolved from the group default / editor default downstream.
 */
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

export function validatePresetCatalog(raw: unknown): PresetCatalog {
  if (!raw || typeof raw !== "object") {
    throw new Error("Preset catalog must be an object");
  }
  const catalog = raw as Record<string, unknown>;
  if (catalog.schemaVersion !== PRESET_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported preset schemaVersion ${String(catalog.schemaVersion)}; expected ${PRESET_SCHEMA_VERSION}`
    );
  }
  if (catalog.version !== undefined && typeof catalog.version !== "string") {
    throw new Error("Preset catalog `version`, if present, must be a string");
  }
  if (catalog.generatedAt !== undefined && typeof catalog.generatedAt !== "string") {
    throw new Error("Preset catalog `generatedAt`, if present, must be a string");
  }
  if (!Array.isArray(catalog.groups) || !Array.isArray(catalog.routes)) {
    throw new Error("Preset catalog needs `groups` and `routes` arrays");
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
  return raw as PresetCatalog;
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
