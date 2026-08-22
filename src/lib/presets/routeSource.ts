import { RouteType } from "../types";
import { RouteCatalog, ResolvedRoute, fetchRouteCatalog, resolveCatalogRoute } from "./catalog";
import { resolveRouteMode } from "./groupLines";

/**
 * A lightweight, searchable descriptor of a real route — what the "Add a route"
 * picker lists. Deliberately cheap: no stops, so a source can return many results
 * (or hit a remote index) without downloading feed data. `id` is opaque and only
 * meaningful to the source that produced it (pass it back to {@link RouteSource.resolve}).
 */
export type RouteSummary = {
  id: string;
  name: string;
  networkId?: string;
  networkName?: string;
  mode?: RouteType;
  color?: string;
  description?: string;
  stopCount?: number;
};

/**
 * Where the editor gets real routes to add to a map. The single seam the picker
 * is written against, so the *host* decides the data: a bundled/curated catalog
 * ({@link staticRouteSource}), a live Mobility Database proxy, or anything else.
 * Both methods are async and cancelable so a live source can hit the network.
 */
export type RouteSource = {
  /** Optional label shown in the picker (e.g. "Mobility Database"). */
  label?: string;
  /**
   * Find routes matching a free-text query. An empty query returns a sensible
   * default/featured set (for a static catalog, everything).
   */
  search(query: string, opts?: { signal?: AbortSignal }): Promise<RouteSummary[]>;
  /** Resolve a summary's `id` into the concrete route + ordered stops to add. */
  resolve(id: string, opts?: { signal?: AbortSignal }): Promise<ResolvedRoute>;
};

/**
 * A {@link RouteSource} backed by an in-memory {@link RouteCatalog} — the
 * zero-backend default (the bundled catalog, or a host-served one). Search is a
 * substring match over route/network name + description; resolve flattens the
 * route's primary pattern to an inline stop list with its transit mode applied.
 */
export function staticRouteSource(catalog: RouteCatalog, label?: string): RouteSource {
  const networksById = new Map(catalog.groups.map((network) => [network.id, network]));
  const routesById = new Map(catalog.routes.map((route) => [route.id, route]));

  const summaries: RouteSummary[] = catalog.routes.map((route) => {
    const network = route.groupId ? (networksById.get(route.groupId) ?? null) : null;
    return {
      id: route.id,
      name: route.name,
      networkId: network?.id,
      networkName: network?.name,
      mode: resolveRouteMode(route, network),
      color: route.color,
      description: route.description,
      stopCount: route.patterns[0]?.stopIds.length,
    };
  });

  return {
    label,
    async search(query) {
      const q = query.trim().toLowerCase();
      if (!q) {
        return summaries;
      }
      return summaries.filter((summary) =>
        `${summary.name} ${summary.description ?? ""} ${summary.networkName ?? ""}`
          .toLowerCase()
          .includes(q)
      );
    },
    async resolve(id) {
      const route = routesById.get(id);
      if (!route) {
        throw new Error(`Unknown route: ${id}`);
      }
      const network = route.groupId ? (networksById.get(route.groupId) ?? null) : null;
      return { ...resolveCatalogRoute(catalog, route), routeType: resolveRouteMode(route, network) };
    },
  };
}

/**
 * A {@link RouteSource} backed by a hosted catalog JSON at `url`, fetched and
 * validated once on first use and cached — so route edits become a redeploy of a
 * JSON file, not a package release. Delegates search/resolve to a
 * {@link staticRouteSource} over the loaded catalog.
 */
export function remoteRouteSource(url: string, init?: RequestInit): RouteSource {
  let cached: Promise<RouteSource> | null = null;
  const load = () => (cached ??= fetchRouteCatalog(url, init).then((catalog) => staticRouteSource(catalog)));
  return {
    async search(query, opts) {
      return (await load()).search(query, opts);
    },
    async resolve(id, opts) {
      return (await load()).resolve(id, opts);
    },
  };
}

/**
 * A live {@link RouteSource} backed by a host endpoint that speaks the
 * search/resolve protocol — pair it with `createMobilityDatabaseHandler` from
 * `@offtrailstudio/transit-mapper/gtfs`, which the host mounts (holding the
 * Mobility Database token). This client is dependency-free (just `fetch`), so it
 * stays in the browser bundle; the heavy GTFS parsing runs server-side behind the
 * endpoint. Lets users search real networks and add any route.
 */
export function mobilityDatabaseRouteSource(config: {
  /** URL of the mounted handler, e.g. "/api/routes". */
  endpoint: string;
  label?: string;
}): RouteSource {
  const { endpoint, label = "Mobility Database" } = config;
  const call = async <T>(
    params: Record<string, string>,
    signal?: AbortSignal
  ): Promise<T> => {
    const url = `${endpoint}?${new URLSearchParams(params).toString()}`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`Route request failed (${res.status} ${res.statusText})`);
    }
    return (await res.json()) as T;
  };
  return {
    label,
    search: (query, opts) => call<RouteSummary[]>({ op: "search", q: query }, opts?.signal),
    resolve: (id, opts) => call<ResolvedRoute>({ op: "resolve", id }, opts?.signal),
  };
}
