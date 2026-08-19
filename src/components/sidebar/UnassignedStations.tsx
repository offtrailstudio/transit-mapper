"use client";

import { useMapData } from "../../context/MapDataContext";
import { getUnassignedStops } from "../../lib/selectors";

export function UnassignedStations() {
  const { state, dispatch, readOnly } = useMapData();
  const unassigned = getUnassignedStops(state.data);
  const activeRoute = state.data.routes.find((route) => route.id === state.activeRouteId);

  if (unassigned.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Unassigned Stations
      </h2>
      <ul className="space-y-1">
        {unassigned.map((stop) => (
          <li
            key={stop.id}
            className="flex items-center gap-1 rounded-md bg-neutral-200 px-2 py-1.5 text-base text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
          >
            <span className="flex-1 truncate">{stop.name}</span>
            {!readOnly && activeRoute && (
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "ADD_STOP_TO_ROUTE", routeId: activeRoute.id, stopId: stop.id })
                }
                className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white"
              >
                + Add
              </button>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => dispatch({ type: "DELETE_STOP", stopId: stop.id })}
                aria-label={`Delete ${stop.name}`}
                className="rounded px-1 text-neutral-500 hover:bg-neutral-200 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-red-400"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
