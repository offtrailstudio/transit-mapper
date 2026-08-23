"use client";

import { useMemo } from "react";
import { useMapData } from "../context/MapDataContext";
import { useSimMode } from "../context/SimModeContext";
import { buildFollowTimeline, followDwellSeconds, FollowTimeline } from "../lib/followAlong";
import { buildRouteScheduleFor, RouteSchedule } from "../lib/simulation";
import { Route } from "../lib/types";
import { useFocusRoute } from "./useFocusRoute";

export type FollowRun = {
  route: Route;
  schedule: RouteSchedule;
  timeline: FollowTimeline;
  /** Stop names in travel order, aligned index-for-index with `timeline.stopIds`. */
  stopNames: string[];
};

/**
 * Everything a follow-along run needs, or null when nothing is being followed
 * (or the followed route has since been deleted or emptied of stops). Shared by
 * the camera, the vehicle layer and the banner so all three ride one timeline —
 * three copies would drift on the frame the map data changes.
 */
export function useFollowRun(): FollowRun | null {
  const { state } = useMapData();
  const { viewMode, multiplier } = useSimMode();
  const route = useFocusRoute();
  const following = viewMode === "follow";

  return useMemo(() => {
    // A hidden route is out of the simulation entirely, so there's no vehicle to
    // ride — following one would glide a lone dot across an empty basemap.
    if (!following || !route || route.hidden) return null;
    const schedule = buildRouteScheduleFor(state.data, route.id);
    if (!schedule) return null;
    // Rebuilt when the speed changes so each hold stays a fixed wall-clock beat. That
    // re-maps elapsed time onto a longer run, so the vehicle steps once on a
    // speed change — a one-off on an explicit action, traded for a stop name
    // that's readable at every multiplier.
    const timeline = buildFollowTimeline(schedule, followDwellSeconds(multiplier));
    if (!timeline) return null;

    const namesById = new Map(state.data.stops.map((stop) => [stop.id, stop.name]));
    return {
      route,
      schedule,
      timeline,
      stopNames: timeline.stopIds.map((id) => namesById.get(id) || "Unnamed stop"),
    };
  }, [state.data, following, route, multiplier]);
}
