import { Action, EditorState, initialEditorState, mapReducer } from "./reducer";
import { TransitMapData } from "./types";

/** Bound the undo stack so a long editing session doesn't grow memory unbounded. */
const MAX_HISTORY = 50;

export type HistoryState = {
  past: TransitMapData[];
  present: EditorState;
  future: TransitMapData[];
};

export type HistoryAction = Action | { type: "UNDO" } | { type: "REDO" };

export const initialHistoryState: HistoryState = {
  past: [],
  present: initialEditorState,
  future: [],
};

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === "UNDO") {
    if (state.past.length === 0) {
      return state;
    }
    const previousData = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, -1),
      present: { ...state.present, data: previousData },
      future: [state.present.data, ...state.future],
    };
  }

  if (action.type === "REDO") {
    if (state.future.length === 0) {
      return state;
    }
    const [nextData, ...rest] = state.future;
    return {
      past: [...state.past, state.present.data],
      present: { ...state.present, data: nextData },
      future: rest,
    };
  }

  // Loading a different map (including switching projects) isn't something
  // you'd want to undo back across, so it resets history entirely.
  if (action.type === "LOAD") {
    return { past: [], present: mapReducer(state.present, action), future: [] };
  }

  const nextPresent = mapReducer(state.present, action);
  if (nextPresent.data === state.present.data) {
    // No data change (e.g. SET_ACTIVE_ROUTE) — update present without touching history.
    return { ...state, present: nextPresent };
  }

  return {
    past: [...state.past, state.present.data].slice(-MAX_HISTORY),
    present: nextPresent,
    future: [],
  };
}
