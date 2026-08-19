"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type TimetableModeContextValue = {
  active: boolean;
  enter: () => void;
  exit: () => void;
};

const TimetableModeContext = createContext<TimetableModeContextValue | null>(null);

/**
 * Transient "timetable view" mode — like sim mode (and pin mode), it's UI state
 * kept out of the undo history. It's opened from the simulation control bar
 * (the timetable is driven by the sim's per-route headways and per-type speeds),
 * so it sits *over* a running sim: `TimetableView` covers the map, and Esc closes
 * just the timetable to return to the sim underneath.
 */
export function TimetableModeProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const enter = useCallback(() => setActive(true), []);
  const exit = useCallback(() => setActive(false), []);

  useEffect(() => {
    if (!active) {
      return;
    }
    // Capture phase + stopImmediatePropagation so Esc closes the timetable
    // WITHOUT also firing sim mode's Esc handler underneath — the timetable is
    // opened from the sim bar, so the sim is still active behind it, and Esc
    // should return there rather than exit both.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setActive(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [active]);

  const value = useMemo(() => ({ active, enter, exit }), [active, enter, exit]);
  return <TimetableModeContext.Provider value={value}>{children}</TimetableModeContext.Provider>;
}

export function useTimetableMode(): TimetableModeContextValue {
  const context = useContext(TimetableModeContext);
  if (!context) {
    throw new Error("useTimetableMode must be used within a TimetableModeProvider");
  }
  return context;
}
