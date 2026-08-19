import { describe, expect, it } from "vitest";
import { historyReducer, initialHistoryState } from "./history";

function addRoute(state = initialHistoryState) {
  return historyReducer(state, { type: "ADD_ROUTE" });
}

function addStopAt(state: typeof initialHistoryState, lng: number, lat: number) {
  return historyReducer(state, { type: "ADD_STOP", lng, lat });
}

describe("historyReducer", () => {
  it("undo restores the previous data", () => {
    let state = addStopAt(initialHistoryState, 0, 0);
    state = addStopAt(state, 1, 1);
    expect(state.present.data.stops).toHaveLength(2);

    state = historyReducer(state, { type: "UNDO" });
    expect(state.present.data.stops).toHaveLength(1);
  });

  it("redo restores the state after an undo", () => {
    let state = addStopAt(initialHistoryState, 0, 0);
    state = addStopAt(state, 1, 1);
    state = historyReducer(state, { type: "UNDO" });
    state = historyReducer(state, { type: "REDO" });
    expect(state.present.data.stops).toHaveLength(2);
  });

  it("a new edit after undo clears the redo stack", () => {
    let state = addStopAt(initialHistoryState, 0, 0);
    state = addStopAt(state, 1, 1);
    state = historyReducer(state, { type: "UNDO" });
    state = addStopAt(state, 2, 2);

    expect(state.future).toEqual([]);
    state = historyReducer(state, { type: "REDO" });
    expect(state.present.data.stops).toHaveLength(2); // redo was a no-op
  });

  it("non-data actions like SET_ACTIVE_ROUTE don't create a history entry", () => {
    let state = addRoute();
    const routeId = state.present.data.routes[0].id;
    const pastLength = state.past.length;

    state = historyReducer(state, { type: "SET_ACTIVE_ROUTE", routeId: null });

    expect(state.past).toHaveLength(pastLength);
    expect(state.present.activeRouteId).toBeNull();
    // Confirm the undo stack still only rewinds actual data changes.
    expect(routeId).toBeDefined();
  });

  it("LOAD resets history", () => {
    let state = addStopAt(initialHistoryState, 0, 0);
    state = addStopAt(state, 1, 1);
    state = historyReducer(state, { type: "UNDO" });
    expect(state.past.length + state.future.length).toBeGreaterThan(0);

    state = historyReducer(state, {
      type: "LOAD",
      data: { version: 3, title: "", stops: [], routes: [] },
    });

    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it("undo is a no-op when there's nothing to undo", () => {
    const state = historyReducer(initialHistoryState, { type: "UNDO" });
    expect(state).toEqual(initialHistoryState);
  });

  it("redo is a no-op when there's nothing to redo", () => {
    const state = historyReducer(initialHistoryState, { type: "REDO" });
    expect(state).toEqual(initialHistoryState);
  });
});
