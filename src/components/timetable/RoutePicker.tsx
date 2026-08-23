"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, EyeOff } from "lucide-react";
import { useMapData } from "../../context/MapDataContext";
import { useSimMode } from "../../context/SimModeContext";
import { useFocusRoute } from "../../hooks/useFocusRoute";
import { Route } from "../../lib/types";

/**
 * Where the picker is mounted: inside the light timetable panel, or floating over
 * the map. The overlay tone carries its own dark pill — it stands alone on the
 * basemap rather than sitting on the sim bar's backdrop, so a translucent fill
 * would leave white text on a pale map.
 */
export type RoutePickerTone = "panel" | "overlay";

const TONE = {
  panel: {
    button:
      "border border-neutral-200 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500",
    menu: "border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
    item: "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800",
    itemSelected: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
    chevron: "text-neutral-400",
  },
  overlay: {
    button: "bg-neutral-900/90 text-white shadow-lg backdrop-blur hover:bg-neutral-900",
    menu: "bg-neutral-900/95 backdrop-blur",
    item: "text-white hover:bg-white/20",
    itemSelected: "bg-white text-neutral-900",
    chevron: "text-white/60",
  },
} as const;

function routeLabel(route: Route): string {
  return route.name || "Untitled route";
}

/**
 * Picks the route the focused simulation modes act on. A dropdown rather than a
 * row of chips: a real network has enough routes that chips wrap onto several
 * rows and push the content below them down the panel.
 *
 * Deliberately *one* control backed by `focusRouteId`, mounted in the top-right
 * of whichever focused mode is showing — the timetable's own header, or the map
 * overlay while following (`FollowRoutePicker`). Reading a route's timetable and
 * then watching it run is then one click on Follow, with no hand-off between two
 * separate selections, and the control never moves on you between modes.
 */
export function RoutePicker({ tone = "panel" }: { tone?: RoutePickerTone }) {
  const { state } = useMapData();
  const { setFocusRoute } = useSimMode();
  const selected = useFocusRoute();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const styles = TONE[tone];

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const routes = state.data.routes;
  if (!selected) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Simulated route"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-8 max-w-48 items-center gap-2 rounded-full px-3 text-sm font-medium transition ${styles.button}`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: selected.routeColor }}
        />
        <span className="truncate">{routeLabel(selected)}</span>
        <ChevronDown size={14} className={`shrink-0 ${styles.chevron}`} />
      </button>

      {open && (
        <div
          role="menu"
          // Right-aligned and dropping downward: both mounts sit in the top-right
          // corner (the timetable's header, the map's overlay), never in the bottom bar.
          className={`absolute right-0 top-full z-30 mt-2 flex max-h-72 w-64 flex-col gap-0.5 overflow-y-auto rounded-lg p-1 shadow-lg ${styles.menu}`}
        >
          {routes.map((route) => {
            const isSelected = route.id === selected.id;
            // `hidden` means "out of the live map *and simulation*" (see types.ts),
            // so a hidden route has nothing to follow or tabulate. Listed but
            // unavailable, rather than dropped — vanishing from the list would
            // read as the route having been deleted.
            const unavailable = Boolean(route.hidden);
            return (
              <button
                key={route.id}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                disabled={unavailable}
                title={unavailable ? "Hidden — show the route to simulate it" : undefined}
                onClick={() => {
                  setFocusRoute(route.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                  isSelected ? styles.itemSelected : styles.item
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: route.routeColor }}
                />
                <span className="truncate">{routeLabel(route)}</span>
                {unavailable && <EyeOff size={13} className="ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
