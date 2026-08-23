"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Crosshair, Map, Table } from "lucide-react";
import { useMapData } from "../../context/MapDataContext";
import { SimViewMode, useSimMode } from "../../context/SimModeContext";
import { useFocusRoute } from "../../hooks/useFocusRoute";

const MODES: { id: SimViewMode; label: string; Icon: typeof Map }[] = [
  { id: "network", label: "Network", Icon: Map },
  { id: "follow", label: "Follow", Icon: Crosshair },
  { id: "timetable", label: "Timetable", Icon: Table },
];

/**
 * Picks what the simulation shows. One icon button opening a menu — the same
 * shape as `SpeedMenu`, so the bar stays a row of equal-weight icons instead of
 * one control shouting louder than the rest.
 *
 * The button wears the *current* mode's icon, which is what keeps the way out
 * visible: the control you press to leave Follow is the one already showing you
 * that you're in it. Only the mode lives here — the route is picked separately
 * (see `FollowRoutePicker`), so this menu never has to nest.
 */
export function ViewModeMenu() {
  const { viewMode, focusRouteId, setViewMode, setFocusRoute } = useSimMode();
  const { state } = useMapData();
  const focusRoute = useFocusRoute();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Both focused modes need a route to act on; with none, only Network works.
  const hasRoutes = state.data.routes.length > 0;
  const current = MODES.find((mode) => mode.id === viewMode) ?? MODES[0];
  const CurrentIcon = current.Icon;

  function choose(mode: SimViewMode) {
    // Entering a focused mode commits whatever route was merely *implied* (the
    // sidebar's active route, or the first one). Without that the follow clock
    // can't tell a fresh subject from a re-entry, and the run would start
    // mid-trip instead of at the origin.
    if (mode !== "network" && focusRoute && !focusRouteId) {
      setFocusRoute(focusRoute.id);
    }
    setViewMode(mode);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Simulation view"
        title={`View: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 items-center gap-0.5 rounded-full bg-white/15 pl-2.5 pr-2 hover:bg-white/25"
      >
        <CurrentIcon size={16} />
        <ChevronDown size={13} />
      </button>

      {open && (
        <div
          role="menu"
          // mb-4, not mb-2: the bar's own py-2 eats half the gap, so 8px from the
          // button leaves the menu flush against the bar's top edge.
          className="absolute bottom-full left-1/2 mb-4 flex w-40 -translate-x-1/2 flex-col gap-0.5 rounded-lg bg-neutral-900/95 p-1 shadow-lg backdrop-blur"
        >
          {MODES.map(({ id, label, Icon }) => {
            const disabled = id !== "network" && !hasRoutes;
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={viewMode === id}
                disabled={disabled}
                title={disabled ? "Add a route first" : undefined}
                onClick={() => choose(id)}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                  viewMode === id ? "bg-white text-neutral-900" : "text-white hover:bg-white/20"
                }`}
              >
                <Icon size={14} className="shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
