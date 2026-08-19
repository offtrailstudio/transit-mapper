"use client";

import { Popup } from "react-map-gl/mapbox";
import { useMapData } from "../../context/MapDataContext";
import { routeStopIds } from "../../lib/lines";

export function StationPopup({ stopId, onClose }: { stopId: string; onClose: () => void }) {
  const { state, dispatch, readOnly } = useMapData();
  const stop = state.data.stops.find((p) => p.id === stopId);
  if (!stop) return null;

  const routes = state.data.routes.filter((route) => routeStopIds(route).includes(stopId));
  const activeRoute = state.data.routes.find((route) => route.id === state.activeRouteId);
  const canAddToActiveRoute = !readOnly && activeRoute && !routeStopIds(activeRoute).includes(stopId);

  return (
    <Popup
      longitude={stop.lng}
      latitude={stop.lat}
      onClose={onClose}
      closeButton={false}
      closeOnClick={false}
      anchor="bottom"
      offset={12}
    >
      <div className="min-w-40 space-y-2 text-base text-neutral-900 dark:text-neutral-100">
        <div className="flex items-start gap-2">
          {readOnly ? (
            <span className="w-full min-w-0 flex-1 truncate px-1.5 py-1 font-semibold text-neutral-900 dark:text-white">
              {stop.name}
            </span>
          ) : (
            <input
              type="text"
              value={stop.name}
              onChange={(e) => dispatch({ type: "RENAME_STOP", stopId, name: e.target.value })}
              className="w-full min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-1.5 py-1 font-semibold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {routes.length > 0 ? (
          <ul className="space-y-1">
            {routes.map((route) => (
              <li key={route.id} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: route.routeColor }}
                />
                <span className="truncate">{route.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-neutral-500">Not on any route yet.</p>
        )}

        {canAddToActiveRoute && (
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "ADD_STOP_TO_ROUTE", routeId: activeRoute.id, stopId })
            }
            className="w-full rounded-md bg-neutral-900 px-2 py-1 text-base font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            + Add to {activeRoute.name}
          </button>
        )}
      </div>
    </Popup>
  );
}
