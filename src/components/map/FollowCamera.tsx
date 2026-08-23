"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/mapbox";
import { useSimMode } from "../../context/SimModeContext";
import { useFollowRun } from "../../hooks/useFollowRun";
import { sampleFollow } from "../../lib/followAlong";

/** Closest the camera pulls in when a run starts; an already-tighter view is kept. */
const FOLLOW_MIN_ZOOM = 12;
const INTRO_MS = 800;

/**
 * Rides the camera along with the followed vehicle. Like `VehiclesLayer` this
 * drives the map imperatively from the sim's frame subscription — never React
 * view state, which would re-render the whole map on every frame.
 */
export function FollowCamera() {
  const { current: mapRef } = useMap();
  const { followRouteId, subscribeFrame, simSecondsRef } = useSimMode();

  // Read through a ref so a settings edit that rebuilds the timeline (changing a
  // line's frequency or its type's speed) doesn't re-run the effect below and
  // yank the camera back through its intro ease mid-run.
  const run = useFollowRun();
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const hasRun = run !== null;

  useEffect(() => {
    const current = runRef.current;
    if (!mapRef || !followRouteId || !current) {
      return;
    }
    const map = mapRef.getMap();
    const start = sampleFollow(current.schedule, current.timeline, simSecondsRef.current).vehicle;

    // Glide to the vehicle first, and only then hand the camera to the per-frame
    // tracker — a jumpTo landing mid-ease fights the animation and stutters.
    let tracking = false;
    map.easeTo({
      center: [start.lng, start.lat],
      zoom: Math.max(map.getZoom(), FOLLOW_MIN_ZOOM),
      duration: INTRO_MS,
    });
    const introTimer = setTimeout(() => {
      tracking = true;
    }, INTRO_MS + 50);

    const unsubscribe = subscribeFrame((simSeconds) => {
      const latest = runRef.current;
      if (!tracking || !latest) {
        return;
      }
      const { vehicle } = sampleFollow(latest.schedule, latest.timeline, simSeconds);
      map.jumpTo({ center: [vehicle.lng, vehicle.lat] });
    });

    return () => {
      clearTimeout(introTimer);
      unsubscribe();
      // Cancel the intro ease if following stopped before it finished, so the
      // camera doesn't keep drifting towards a vehicle nobody is watching.
      map.stop();
    };
    // Re-aims only when the followed route changes (or first becomes followable),
    // never when its timing is retuned — see the ref above.
  }, [mapRef, followRouteId, hasRun, subscribeFrame, simSecondsRef]);

  return null;
}
