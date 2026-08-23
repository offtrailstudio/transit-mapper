"use client";

import { useMemo } from "react";
import { useMapData } from "../context/MapDataContext";
import { useSimMode } from "../context/SimModeContext";
import { Route } from "../lib/types";

/**
 * The route the focused simulation modes act on, resolved rather than stored.
 *
 * `focusRouteId` starts null, so before anything is picked this falls back to
 * the route the sidebar has expanded and then to the first route — opening
 * Follow or Timetable lands on the route you were already working on instead of
 * an arbitrary one. Keeping the fallback here (not in `SimModeContext`) leaves
 * the playback context free of map data, and means a deleted focus route
 * degrades to a sensible one instead of a blank panel.
 */
export function useFocusRoute(): Route | null {
  const { state } = useMapData();
  const { focusRouteId } = useSimMode();
  const routes = state.data.routes;
  const activeRouteId = state.activeRouteId;

  return useMemo(
    () =>
      routes.find((route) => route.id === focusRouteId) ??
      routes.find((route) => route.id === activeRouteId) ??
      routes[0] ??
      null,
    [routes, focusRouteId, activeRouteId]
  );
}
