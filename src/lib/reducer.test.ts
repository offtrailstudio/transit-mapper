import { describe, expect, it } from "vitest";
import { nextRouteColor } from "./colors";
import { ROUTE_TYPE_DEFAULTS } from "./lineKinds";
import { routeStopIds, primaryStopIds } from "./lines";
import { ResolvedRoute } from "./presets";
import { EditorState, initialEditorState, mapReducer } from "./reducer";

const FIXTURE_PRESET: ResolvedRoute = {
  id: "fixture-route",
  name: "Fixture Route",
  color: "#123456",
  stops: [
    { id: "alpha", name: "Alpha", lng: 0, lat: 0 },
    { id: "beta", name: "Beta", lng: 1, lat: 1 },
  ],
};

function addRoute(state: EditorState): EditorState {
  return mapReducer(state, { type: "ADD_ROUTE" });
}

function addStopAt(state: EditorState, lng: number, lat: number): EditorState {
  return mapReducer(state, { type: "ADD_STOP", lng, lat });
}

describe("mapReducer", () => {
  it("ADD_ROUTE creates a route and makes it active", () => {
    const state = addRoute(initialEditorState);
    expect(state.data.routes).toHaveLength(1);
    expect(state.data.routes[0].name).toBe("Route 1");
    expect(state.activeRouteId).toBe(state.data.routes[0].id);
  });

  it("ADD_STOP with no active route just creates an unassigned stop", () => {
    const state = addStopAt(initialEditorState, -73.98, 40.75);
    expect(state.data.stops).toHaveLength(1);
    expect(state.data.routes).toHaveLength(0);
  });

  it("ADD_STOP with an active route appends the new stop to that route's stops", () => {
    let state = addRoute(initialEditorState);
    state = addStopAt(state, -73.98, 40.75);
    state = addStopAt(state, -73.99, 40.76);

    const route = state.data.routes[0];
    expect(state.data.stops).toHaveLength(2);
    expect(primaryStopIds(route)).toEqual(state.data.stops.map((p) => p.id));
  });

  it("ADD_STOP with an explicit routeId targets that route, not the active one", () => {
    let state = addRoute(initialEditorState); // Route 1, becomes active
    state = addRoute(state); // Route 2, now active
    const [routeOne, routeTwo] = state.data.routes;

    state = mapReducer(state, { type: "ADD_STOP", lng: 1, lat: 2, routeId: routeOne.id });

    const newStopId = state.data.stops[0].id;
    expect(primaryStopIds(state.data.routes.find((l) => l.id === routeOne.id)!)).toEqual([newStopId]);
    expect(primaryStopIds(state.data.routes.find((l) => l.id === routeTwo.id)!)).toEqual([]);
  });

  it("ADD_STOP with an explicit routeId still works when no route is active", () => {
    let state = addRoute(initialEditorState);
    const routeId = state.data.routes[0].id;
    state = mapReducer(state, { type: "SET_ACTIVE_ROUTE", routeId: null });

    state = mapReducer(state, { type: "ADD_STOP", lng: 1, lat: 2, routeId });

    expect(primaryStopIds(state.data.routes[0])).toEqual([state.data.stops[0].id]);
  });

  it("ADD_STOP_TO_ROUTE appends an existing stop without duplicating it", () => {
    let state = addStopAt(initialEditorState, -73.98, 40.75);
    state = addRoute(state);
    const routeId = state.data.routes[0].id;
    const stopId = state.data.stops[0].id;

    state = mapReducer(state, { type: "ADD_STOP_TO_ROUTE", routeId, stopId });
    state = mapReducer(state, { type: "ADD_STOP_TO_ROUTE", routeId, stopId });

    expect(primaryStopIds(state.data.routes[0])).toEqual([stopId]);
  });

  it("REORDER_STOP swaps adjacent stops and no-ops past the boundaries", () => {
    let state = addRoute(initialEditorState);
    state = addStopAt(state, 0, 0);
    state = addStopAt(state, 1, 1);
    state = addStopAt(state, 2, 2);
    const routeId = state.data.routes[0].id;
    const [a, b, c] = primaryStopIds(state.data.routes[0]);

    state = mapReducer(state, { type: "REORDER_STOP", routeId, index: 1, direction: "up" });
    expect(primaryStopIds(state.data.routes[0])).toEqual([b, a, c]);

    // moving the first stop up is a no-op
    state = mapReducer(state, { type: "REORDER_STOP", routeId, index: 0, direction: "up" });
    expect(primaryStopIds(state.data.routes[0])).toEqual([b, a, c]);

    // moving the last stop down is a no-op
    state = mapReducer(state, { type: "REORDER_STOP", routeId, index: 2, direction: "down" });
    expect(primaryStopIds(state.data.routes[0])).toEqual([b, a, c]);
  });

  it("REMOVE_STOP only affects the target route, not the stop itself", () => {
    let state = addRoute(initialEditorState);
    state = addStopAt(state, 0, 0);
    const routeId = state.data.routes[0].id;
    const stopId = state.data.stops[0].id;

    state = mapReducer(state, { type: "REMOVE_STOP", routeId, stopId });

    expect(primaryStopIds(state.data.routes[0])).toEqual([]);
    expect(state.data.stops).toHaveLength(1);
  });

  it("DELETE_STOP removes the stop and cascades out of every route's stops", () => {
    let state = addRoute(initialEditorState);
    state = addStopAt(state, 0, 0);
    const secondRoute = mapReducer(state, { type: "ADD_ROUTE" });
    state = mapReducer(secondRoute, {
      type: "ADD_STOP_TO_ROUTE",
      routeId: secondRoute.data.routes[0].id,
      stopId: secondRoute.data.stops[0].id,
    });
    const stopId = state.data.stops[0].id;

    state = mapReducer(state, { type: "DELETE_STOP", stopId });

    expect(state.data.stops).toHaveLength(0);
    expect(state.data.routes.every((route) => !routeStopIds(route).includes(stopId))).toBe(true);
  });

  it("DELETE_ROUTE clears activeRouteId only when the deleted route was active", () => {
    let state = addRoute(initialEditorState);
    const routeId = state.data.routes[0].id;

    state = mapReducer(state, { type: "DELETE_ROUTE", routeId });

    expect(state.data.routes).toHaveLength(0);
    expect(state.activeRouteId).toBeNull();
  });

  it("ADD_STOP uses a provided name instead of the auto-generated one", () => {
    const state = mapReducer(initialEditorState, {
      type: "ADD_STOP",
      lng: 0,
      lat: 0,
      name: "Grand Central",
    });
    expect(state.data.stops[0].name).toBe("Grand Central");
  });

  it("RENAME_STOP renames only the target stop", () => {
    let state = addStopAt(initialEditorState, 0, 0);
    state = addStopAt(state, 1, 1);
    const [first, second] = state.data.stops;

    state = mapReducer(state, { type: "RENAME_STOP", stopId: first.id, name: "Renamed" });

    expect(state.data.stops.find((p) => p.id === first.id)?.name).toBe("Renamed");
    expect(state.data.stops.find((p) => p.id === second.id)?.name).toBe(second.name);
  });

  it("MOVE_STOP updates only the target stop's coordinates", () => {
    let state = addStopAt(initialEditorState, 0, 0);
    state = addStopAt(state, 1, 1);
    const [first, second] = state.data.stops;

    state = mapReducer(state, { type: "MOVE_STOP", stopId: first.id, lng: 5, lat: 6 });

    const movedFirst = state.data.stops.find((p) => p.id === first.id);
    expect(movedFirst?.lng).toBe(5);
    expect(movedFirst?.lat).toBe(6);
    expect(state.data.stops.find((p) => p.id === second.id)).toEqual(second);
  });

  it("SET_TITLE updates the map's title", () => {
    const state = mapReducer(initialEditorState, { type: "SET_TITLE", title: "My Transit Map" });
    expect(state.data.title).toBe("My Transit Map");
  });

  it("TOGGLE_ROUTE_VISIBILITY flips only the target route's hidden flag", () => {
    let state = addRoute(initialEditorState); // Route 1
    state = addRoute(state); // Route 2
    const [routeOne, routeTwo] = state.data.routes;
    expect(routeOne.hidden).toBeFalsy();

    state = mapReducer(state, { type: "TOGGLE_ROUTE_VISIBILITY", routeId: routeOne.id });
    expect(state.data.routes.find((r) => r.id === routeOne.id)?.hidden).toBe(true);
    expect(state.data.routes.find((r) => r.id === routeTwo.id)?.hidden).toBeFalsy();

    state = mapReducer(state, { type: "TOGGLE_ROUTE_VISIBILITY", routeId: routeOne.id });
    expect(state.data.routes.find((r) => r.id === routeOne.id)?.hidden).toBe(false);
  });
});

describe("ADD_CATALOG_ROUTE", () => {
  it("creates one route and a stop per stop, in order", () => {
    const state = mapReducer(initialEditorState, { type: "ADD_CATALOG_ROUTE", route: FIXTURE_PRESET });

    expect(state.data.routes).toHaveLength(1);
    expect(state.data.stops).toHaveLength(2);
    expect(state.data.stops.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
    expect(primaryStopIds(state.data.routes[0])).toEqual(state.data.stops.map((p) => p.id));
  });

  it("uses the preset's name and color when provided", () => {
    const state = mapReducer(initialEditorState, { type: "ADD_CATALOG_ROUTE", route: FIXTURE_PRESET });

    expect(state.data.routes[0].name).toBe("Fixture Route");
    expect(state.data.routes[0].routeColor).toBe("#123456");
  });

  it("falls back to nextRouteColor when the preset omits a color", () => {
    const presetWithoutColor: ResolvedRoute = { ...FIXTURE_PRESET, color: undefined };
    let state = mapReducer(initialEditorState, {
      type: "ADD_CATALOG_ROUTE",
      route: presetWithoutColor,
    });
    expect(state.data.routes[0].routeColor).toBe(nextRouteColor(0));

    state = mapReducer(state, { type: "ADD_CATALOG_ROUTE", route: presetWithoutColor });
    expect(state.data.routes[1].routeColor).toBe(nextRouteColor(1));
  });

  it("sets the new route as active", () => {
    const state = mapReducer(initialEditorState, { type: "ADD_CATALOG_ROUTE", route: FIXTURE_PRESET });
    expect(state.activeRouteId).toBe(state.data.routes[0].id);
  });

  it("is additive — leaves existing routes and stops untouched", () => {
    let state = addRoute(initialEditorState);
    state = addStopAt(state, 5, 5);
    const existingRoute = state.data.routes[0];
    const existingStop = state.data.stops[0];

    state = mapReducer(state, { type: "ADD_CATALOG_ROUTE", route: FIXTURE_PRESET });

    expect(state.data.routes).toContainEqual(existingRoute);
    expect(state.data.stops).toContainEqual(existingStop);
    expect(state.data.routes).toHaveLength(2);
    expect(state.data.stops).toHaveLength(3);
  });

  it("mints unique stop ids across repeated dispatches", () => {
    let state = mapReducer(initialEditorState, { type: "ADD_CATALOG_ROUTE", route: FIXTURE_PRESET });
    state = mapReducer(state, { type: "ADD_CATALOG_ROUTE", route: FIXTURE_PRESET });

    const ids = state.data.stops.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reuses an existing stop for a merged stop instead of duplicating it", () => {
    let state = mapReducer(initialEditorState, { type: "ADD_CATALOG_ROUTE", route: FIXTURE_PRESET });
    const sharedId = state.data.stops[0].id; // "Alpha"

    // A second preset whose first stop is the same station as Alpha.
    const overlapping: ResolvedRoute = {
      id: "overlap",
      name: "Overlap Route",
      stops: [
        { id: "alpha2", name: "Alpha", lng: 0, lat: 0 },
        { id: "gamma", name: "Gamma", lng: 2, lat: 2 },
      ],
    };
    state = mapReducer(state, {
      type: "ADD_CATALOG_ROUTE",
      route: overlapping,
      merges: { 0: sharedId },
    });

    // One net new stop (Gamma), not two.
    expect(state.data.stops).toHaveLength(3);
    expect(state.data.stops.map((p) => p.name)).toEqual(["Alpha", "Beta", "Gamma"]);

    const overlapRoute = state.data.routes[1];
    expect(primaryStopIds(overlapRoute)[0]).toBe(sharedId);
    expect(primaryStopIds(overlapRoute)[1]).toBe(state.data.stops[2].id);
  });

  it("ignores merge ids that don't stop at a real station", () => {
    const state = mapReducer(initialEditorState, {
      type: "ADD_CATALOG_ROUTE",
      route: FIXTURE_PRESET,
      merges: { 0: "does-not-exist" },
    });

    // Falls back to minting a fresh stop rather than leaving a dangling ref.
    expect(state.data.stops).toHaveLength(2);
    expect(primaryStopIds(state.data.routes[0])).toEqual(state.data.stops.map((p) => p.id));
  });

  it("defaults a preset with no routeType to the subway type and its headway", () => {
    const state = mapReducer(initialEditorState, { type: "ADD_CATALOG_ROUTE", route: FIXTURE_PRESET });
    expect(state.data.routes[0].routeType).toBe("subway");
    expect(state.data.routes[0].headwayMin).toBe(5);
  });

  it("honors a preset's routeType and seeds that type's headway", () => {
    const busPreset: ResolvedRoute = { ...FIXTURE_PRESET, routeType: "bus" };
    const state = mapReducer(initialEditorState, { type: "ADD_CATALOG_ROUTE", route: busPreset });
    expect(state.data.routes[0].routeType).toBe("bus");
    expect(state.data.routes[0].headwayMin).toBe(10); // bus default
  });

  it("ADD_ROUTE seeds simulation params from the default type", () => {
    const route = addRoute(initialEditorState).data.routes[0];
    expect(route.routeType).toBe("subway");
    expect(route.headwayMin).toBe(5);
  });

  it("SET_ROUTE_TYPE changes the type and re-seeds the headway to its default", () => {
    let state = addRoute(initialEditorState);
    const routeId = state.data.routes[0].id;
    state = mapReducer(state, { type: "SET_ROUTE_HEADWAY", routeId, headwayMin: 99 });
    state = mapReducer(state, { type: "SET_ROUTE_TYPE", routeId, routeType: "ferry" });
    expect(state.data.routes[0].routeType).toBe("ferry");
    expect(state.data.routes[0].headwayMin).toBe(25); // ferry default, overriding the 99
  });

  it("SET_ROUTE_HEADWAY updates only that route's headway", () => {
    let state = addRoute(initialEditorState);
    const routeId = state.data.routes[0].id;
    state = mapReducer(state, { type: "SET_ROUTE_HEADWAY", routeId, headwayMin: 3 });
    expect(state.data.routes[0].headwayMin).toBe(3);
    expect(state.data.routes[0].routeType).toBe("subway");
  });

  it("SET_ROUTE_TYPE_SPEED edits the project-wide speed table", () => {
    const state = mapReducer(initialEditorState, { type: "SET_ROUTE_TYPE_SPEED", routeType: "hsr", speedKmh: 250 });
    expect(state.data.routeTypes?.hsr.speedKmh).toBe(250);
    // Untouched: still the seed, whatever that seed currently is.
    expect(state.data.routeTypes?.subway.speedKmh).toBe(ROUTE_TYPE_DEFAULTS.subway.speedKmh);
  });
});
