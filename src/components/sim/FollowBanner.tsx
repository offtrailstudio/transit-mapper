"use client";

import { useEffect, useState } from "react";
import { useSimMode } from "../../context/SimModeContext";
import { useFocusRoute } from "../../hooks/useFocusRoute";
import { useFollowRun } from "../../hooks/useFollowRun";
import { sampleFollow } from "../../lib/followAlong";

type Marker = { stopIndex: number; dwelling: boolean };

/**
 * The stop readout for a follow-along run: which stop the vehicle is holding at,
 * or which one it's heading for. Driven by the same per-frame subscription the
 * vehicle layer uses, but it re-renders only when the stop or the hold/move
 * phase actually changes — a few times a minute, not sixty times a second.
 */
export function FollowBanner() {
  const { active, viewMode, subscribeFrame, simSecondsRef } = useSimMode();
  const focusRoute = useFocusRoute();
  const run = useFollowRun();
  const [marker, setMarker] = useState<Marker | null>(null);

  useEffect(() => {
    if (!run) {
      setMarker(null);
      return;
    }
    let last = "";
    const update = (simSeconds: number) => {
      const { stopIndex, dwelling } = sampleFollow(run.schedule, run.timeline, simSeconds);
      const key = `${stopIndex}:${dwelling}`;
      if (key !== last) {
        last = key;
        setMarker({ stopIndex, dwelling });
      }
    };
    // Seed synchronously so the banner is correct on its first paint, before the
    // animation loop has delivered a frame (and even while playback is paused).
    update(simSecondsRef.current);
    return subscribeFrame(update);
  }, [run, subscribeFrame, simSecondsRef]);

  if (!active || viewMode !== "follow") {
    return null;
  }

  // Following a route with nothing to run — hidden, or fewer than two placed
  // stops — would otherwise look like a mode that silently did nothing. Say
  // which, the way the timetable does for the same cases.
  if (!run || !marker) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center px-4">
        <p className="pointer-events-auto rounded-2xl bg-neutral-900/90 px-4 py-2.5 text-sm text-white shadow-lg backdrop-blur">
          {!focusRoute
            ? "Add a route to follow."
            : focusRoute.hidden
              ? `${focusRoute.name || "This route"} is hidden — show it to follow along.`
              : `${focusRoute.name || "This route"} needs at least two stops to follow.`}
        </p>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center px-4">
      {/* Caption over name. No route name (the picker in the top-right holds it)
          and no stop counter — what matters mid-run is which stop is next, and
          the pair of them crowded it. aria-live sits on the pill so a change of
          phase announces with its stop, not as two separate updates. */}
      <div
        className="pointer-events-auto w-full max-w-xs rounded-2xl bg-neutral-900/90 px-4 py-2.5 text-white shadow-lg backdrop-blur"
        aria-live="polite"
      >
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: run.route.routeColor }}
          />
          {marker.dwelling ? "Now at" : "Next stop"}
        </p>
        <p className="mt-0.5 truncate text-lg font-semibold">
          {run.stopNames[marker.stopIndex]}
        </p>
      </div>
    </div>
  );
}
