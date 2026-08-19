"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type PinModeContextValue = {
  /** The route the next map click should add a stop to, or null when the map is inert. */
  pinRouteId: string | null;
  startPinMode: (routeId: string) => void;
  cancelPinMode: () => void;
};

const PinModeContext = createContext<PinModeContextValue | null>(null);

/**
 * Placing a stop by clicking the map is a deliberate mode rather than the map's
 * default behaviour — clicking used to drop a station anywhere, which made it far
 * too easy to litter the map while panning or dismissing a popup.
 */
export function PinModeProvider({ children }: { children: React.ReactNode }) {
  const [pinRouteId, setPinRouteId] = useState<string | null>(null);

  const startPinMode = useCallback((routeId: string) => setPinRouteId(routeId), []);
  const cancelPinMode = useCallback(() => setPinRouteId(null), []);

  useEffect(() => {
    if (!pinRouteId) {
      return;
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPinRouteId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pinRouteId]);

  const value = useMemo(
    () => ({ pinRouteId, startPinMode, cancelPinMode }),
    [pinRouteId, startPinMode, cancelPinMode]
  );

  return <PinModeContext.Provider value={value}>{children}</PinModeContext.Provider>;
}

export function usePinMode(): PinModeContextValue {
  const context = useContext(PinModeContext);
  if (!context) {
    throw new Error("usePinMode must be used within a PinModeProvider");
  }
  return context;
}
