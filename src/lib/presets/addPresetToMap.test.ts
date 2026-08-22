import { describe, expect, it } from "vitest";
import { BUNDLED_ROUTE_CATALOG, resolveCatalogRoute } from "./index";
import { initialEditorState, mapReducer } from "../reducer";
import { primaryStopIds } from "../lines";

/**
 * End-to-end proof of the real add-a-preset flow: the *bundled* v2 catalog
 * (normalized stops + pattern stopIds) → `resolveCatalogRoute` → the reducer's
 * `ADD_CATALOG_ROUTE` → an actual route + stops on the map. Guards the seam the v2
 * migration introduced, which the fixture-based reducer test doesn't exercise.
 */
describe("adding a bundled preset route to a map", () => {
  const catalog = BUNDLED_ROUTE_CATALOG;

  it("lands a real catalog route as a route with its stops, in order", () => {
    const route = catalog.routes.find((r) => r.id === "amtrak-northeast-regional")!;
    const resolved = resolveCatalogRoute(catalog, route);
    const expected = route.patterns[0].stopIds.length;

    const state = mapReducer(initialEditorState, { type: "ADD_CATALOG_ROUTE", preset: resolved });

    expect(state.data.routes).toHaveLength(1);
    expect(state.data.routes[0].name).toBe("Northeast Regional");
    expect(state.data.stops).toHaveLength(expected);
    expect(primaryStopIds(state.data.routes[0])).toHaveLength(expected);
    expect(state.data.stops.map((s) => s.name)).toEqual(resolved.stops.map((s) => s.name));
    expect(state.activeRouteId).toBe(state.data.routes[0].id);
  });

  it("resolves every bundled route to a fully-referenced (≥2) primary stop list", () => {
    expect(catalog.routes.length).toBeGreaterThan(0);
    for (const route of catalog.routes) {
      const resolved = resolveCatalogRoute(catalog, route);
      // No dangling stopIds: resolved length equals the primary pattern length.
      expect(resolved.stops.length, `${route.id}`).toBe(route.patterns[0].stopIds.length);
      expect(resolved.stops.length, `${route.id} is a line`).toBeGreaterThanOrEqual(2);
    }
  });
});
