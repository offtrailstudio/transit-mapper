"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useMapData } from "../../context/MapDataContext";
import { primaryStopIds } from "../../lib/lines";
import { Route } from "../../lib/types";
import { AddStopModal } from "./AddStopModal";

export function RouteEditor({ route }: { route: Route }) {
  const { state, dispatch, readOnly } = useMapData();
  const [isAddStopOpen, setIsAddStopOpen] = useState(false);

  const stopsById = new Map(state.data.stops.map((p) => [p.id, p]));
  const stopIds = primaryStopIds(route);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {readOnly ? (
          <>
            <span
              className="h-5 w-5 shrink-0 rounded-full"
              style={{ backgroundColor: route.routeColor }}
            />
            <span className="w-full truncate text-base font-medium text-neutral-900 dark:text-white">
              {route.name}
            </span>
          </>
        ) : (
          <>
            <input
              type="color"
              value={route.routeColor}
              onChange={(e) =>
                dispatch({ type: "SET_ROUTE_COLOR", routeId: route.id, routeColor: e.target.value })
              }
              className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent"
            />
            <input
              type="text"
              value={route.name}
              onChange={(e) => dispatch({ type: "RENAME_ROUTE", routeId: route.id, name: e.target.value })}
              className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
          </>
        )}
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Stops
        </h3>
        {stopIds.length === 0 ? (
          <p className="text-base text-neutral-500">
            {readOnly ? "No stops on this route." : "No stops yet — add one below."}
          </p>
        ) : (
          <ol className="space-y-1">
            {stopIds.map((stopId, index) => {
              const stop = stopsById.get(stopId);
              if (!stop) return null;
              return (
                <li
                  key={stopId}
                  className="flex items-center gap-1 rounded-md bg-neutral-200 px-2 py-1 text-base text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  <span className="w-4 shrink-0 text-xs text-neutral-500">{index + 1}</span>
                  <span className="flex-1 truncate">{stop.name}</span>
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() =>
                          dispatch({ type: "REORDER_STOP", routeId: route.id, index, direction: "up" })
                        }
                        aria-label={`Move ${stop.name} up`}
                        className="rounded px-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30 dark:text-neutral-400 dark:hover:bg-neutral-700"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === stopIds.length - 1}
                        onClick={() =>
                          dispatch({ type: "REORDER_STOP", routeId: route.id, index, direction: "down" })
                        }
                        aria-label={`Move ${stop.name} down`}
                        className="rounded px-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30 dark:text-neutral-400 dark:hover:bg-neutral-700"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: "REMOVE_STOP", routeId: route.id, stopId: stopId })
                        }
                        aria-label={`Remove ${stop.name} from ${route.name}`}
                        className="rounded px-1 text-neutral-500 hover:bg-neutral-200 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-red-400"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {!readOnly && (
        <>
          <button
            type="button"
            onClick={() => setIsAddStopOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-300 px-2 py-1.5 text-base font-medium text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Plus size={16} />
            Add stop
          </button>

          <AddStopModal route={route} open={isAddStopOpen} onClose={() => setIsAddStopOpen(false)} />
        </>
      )}
    </div>
  );
}
