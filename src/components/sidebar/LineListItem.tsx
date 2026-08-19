"use client";

import { Eye, EyeOff } from "lucide-react";
import { useMapData } from "../../context/MapDataContext";
import { routeStopIds } from "../../lib/lines";
import { Route } from "../../lib/types";
import { RouteEditor } from "./LineEditor";

export function RouteListItem({ route }: { route: Route }) {
  const { state, dispatch, readOnly } = useMapData();
  const isExpanded = route.id === state.activeRouteId;

  return (
    <li className="rounded-md bg-neutral-200/60 dark:bg-neutral-900/40">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => dispatch({ type: "TOGGLE_ROUTE_VISIBILITY", routeId: route.id })}
          aria-pressed={!route.hidden}
          title={route.hidden ? "Show route" : "Hide route"}
          className="shrink-0 rounded-l-md px-2 py-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          {route.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          <span className="sr-only">{route.hidden ? "Show route" : "Hide route"}</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_ACTIVE_ROUTE", routeId: isExpanded ? null : route.id })}
          aria-expanded={isExpanded}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-r-md px-2 py-1.5 text-left text-base ${
            isExpanded
              ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-white"
              : "text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
          } ${route.hidden ? "opacity-50" : ""}`}
        >
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: route.routeColor }} />
          <span className="min-w-0 truncate">{route.name}</span>
          <span className="ml-auto text-xs text-neutral-500">{routeStopIds(route).length}</span>
          <span className="text-xs text-neutral-500">{isExpanded ? "▾" : "▸"}</span>
        </button>
      </div>
      {isExpanded && (
        <div className="space-y-4 px-2 pb-3 pt-2">
          <RouteEditor route={route} />
          {!readOnly && (
            <button
              type="button"
              onClick={() => dispatch({ type: "DELETE_ROUTE", routeId: route.id })}
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-base font-medium text-neutral-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              Delete route
            </button>
          )}
        </div>
      )}
    </li>
  );
}
