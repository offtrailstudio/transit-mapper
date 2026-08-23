"use client";

import { useMemo, useState } from "react";
import { useMapData } from "../../context/MapDataContext";
import { useSimMode } from "../../context/SimModeContext";
import { useFocusRoute } from "../../hooks/useFocusRoute";
import { buildRouteTimetable, secondsToClock, stopIndexAt, tripDepartures } from "../../lib/timetable";
import { RoutePicker } from "./RoutePicker";

const MAX_TRIP_COLUMNS = 10;

/** "3:20" — minutes:seconds, minutes uncapped (a trip rarely exceeds an hour). */
function durationLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse an "HH:MM" time input to seconds since midnight, or null if malformed. */
function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) {
    return null;
  }
  return h * 3600 + m * 60;
}

/**
 * Full schedule view that replaces the map while timetable mode is active — the
 * timetable analogue of the map itself, not an overlay. Mounted in the shell's
 * main area and covers it (`absolute inset-0`), so the sidebar and rail stay put.
 * Times come from the same `buildRouteTimetable` → `buildRouteSchedule` engine the
 * simulation runs on, so a printed timetable can't disagree with the vehicles.
 */
export function TimetableView() {
  // Re-renders a few times a second while the sim plays, moving the live markers.
  const { displaySeconds, viewMode } = useSimMode();
  const { state } = useMapData();
  const routes = state.data.routes;
  const active = viewMode === "timetable";

  // Anchor the window near the current sim time (rounded to the half hour) so the
  // live highlight is visible as soon as the timetable opens; still adjustable.
  const [firstDeparture, setFirstDeparture] = useState(() => Math.max(0, Math.floor(displaySeconds / 1800) * 1800));

  // Shared with Follow, so switching between the two keeps the same route.
  const selected = useFocusRoute();
  const timetable = useMemo(
    () => (selected ? buildRouteTimetable(state.data, selected) : null),
    [state.data, selected]
  );

  const departures = useMemo(() => {
    if (!timetable || timetable.headwaySec <= 0) {
      return [];
    }
    const last = firstDeparture + (MAX_TRIP_COLUMNS - 1) * timetable.headwaySec;
    return tripDepartures(firstDeparture, timetable.headwaySec, last);
  }, [timetable, firstDeparture]);

  // The stop each shown trip's train is currently at (null = not in flight), so
  // the matching cell can light up. Recomputed as the sim clock ticks.
  const activeStops = useMemo(
    () =>
      timetable
        ? departures.map((dep) => stopIndexAt(timetable.stops, timetable.tripSeconds, displaySeconds - dep))
        : [],
    [timetable, departures, displaySeconds]
  );

  if (!active) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Timetable</h2>
        <RoutePicker />
      </div>

      {routes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">
          Add a route to see its timetable.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {selected?.hidden ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">
              {selected.name || "This route"} is hidden — show it to see its timetable.
            </div>
          ) : !timetable ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">
              This route needs at least two stops to build a timetable.
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-sm text-neutral-600 dark:text-neutral-300">
                <span>{timetable.stops.length} stops</span>
                <span aria-hidden>·</span>
                <span>
                  {timetable.headwaySec > 0
                    ? `Every ${Math.round(timetable.headwaySec / 60)} min`
                    : "Frequency not set"}
                </span>
                <span aria-hidden>·</span>
                <span>Full trip {durationLabel(timetable.tripSeconds)}</span>
                {timetable.headwaySec > 0 && (
                  <label className="ml-auto flex items-center gap-2">
                    <span className="text-neutral-500">First departure</span>
                    <input
                      type="time"
                      value={secondsToClock(firstDeparture)}
                      onChange={(e) => {
                        const parsed = parseClock(e.target.value);
                        if (parsed !== null) {
                          setFirstDeparture(parsed);
                        }
                      }}
                      className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                    />
                  </label>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-auto px-5 pb-5">
                <table className="border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="sticky left-0 z-10 bg-white pb-2 pr-4 dark:bg-neutral-950">Stop</th>
                      <th className="pb-2 pr-4 font-medium">From start</th>
                      {departures.map((dep, i) => (
                        <th key={i} className="px-2 pb-2 font-medium tabular-nums">
                          {secondsToClock(dep)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timetable.stops.map((stop, si) => (
                      <tr key={stop.stopId}>
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-1.5 pr-4 font-medium text-neutral-900 dark:bg-neutral-950 dark:text-white">
                          {stop.name}
                        </td>
                        <td className="py-1.5 pr-4 tabular-nums text-neutral-500">
                          +{durationLabel(stop.arrivalSec)}
                        </td>
                        {departures.map((dep, i) => {
                          const active = activeStops[i] === si;
                          return (
                            <td
                              key={i}
                              className={`rounded px-2 py-1.5 tabular-nums ${
                                active
                                  ? "font-semibold text-neutral-900 dark:text-white"
                                  : "text-neutral-800 dark:text-neutral-200"
                              }`}
                              style={active ? { backgroundColor: `${timetable.color}33` } : undefined}
                            >
                              {secondsToClock(dep + stop.arrivalSec)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
