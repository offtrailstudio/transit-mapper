import { Route, StopPattern } from "./types";

/**
 * Stop-pattern accessors for a route. A `Route` (GTFS route) owns one or more
 * `StopPattern`s rather than a bare stop list; `normalizeMapData` guarantees at
 * least one. Editing today targets the *primary* (first) pattern — multi-pattern
 * authoring and rendering are a later increment — so these keep every consumer
 * reading the same sequence it always did.
 *
 * All accessors tolerate a not-yet-normalized route (missing/empty `patterns`) so
 * a raw test fixture or partially-loaded blob degrades to "no stops" instead of
 * throwing.
 */

/** The route's primary (first) stop pattern, or undefined if it has none. */
export function primaryPattern(route: Route): StopPattern | undefined {
  return route.patterns?.[0];
}

/** The ordered stop ids of the route's primary pattern — the sequence UI edits and geometry draws. */
export function primaryStopIds(route: Route): string[] {
  return route.patterns?.[0]?.stopIds ?? [];
}

/** Every stop id the route serves, across all its patterns, in first-seen order (deduped). */
export function routeStopIds(route: Route): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const pattern of route.patterns ?? []) {
    for (const id of pattern.stopIds) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/**
 * Returns a copy of `route` with the primary pattern's stop ids transformed by
 * `update`. Seeds a primary pattern if somehow absent, so an edit never no-ops
 * on unnormalized data.
 */
export function updatePrimaryStopIds(route: Route, update: (stopIds: string[]) => string[]): Route {
  const patterns = route.patterns?.length ? route.patterns : [{ id: crypto.randomUUID(), stopIds: [] }];
  const [first, ...rest] = patterns;
  return { ...route, patterns: [{ ...first, stopIds: update(first.stopIds) }, ...rest] };
}
