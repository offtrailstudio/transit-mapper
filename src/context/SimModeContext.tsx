"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const SIM_MULTIPLIERS = [1, 2, 5, 10, 60];
/**
 * Real time is far too slow to read a network by: at 1× a bus barely crawls
 * between stops, so the simulation opens at the fastest step and users step
 * *down* if they want detail. Follow mode stays readable at any step because its
 * stop dwell is measured in real seconds and scaled by this — see
 * `followDwellSeconds`.
 */
const DEFAULT_MULTIPLIER = 60;
/** The simulated clock reads as a time of day, starting from midnight. */
const START_OF_DAY_SECONDS = 0;

type FrameSubscriber = (simSeconds: number) => void;

/**
 * What the simulation is showing. All three run on the same clock — pause, speed
 * and reset apply to every one — they differ only in what's on screen:
 * `network` every route's vehicles on the map, `follow` one vehicle with the
 * camera riding it, `timetable` that route's schedule instead of the map.
 */
export type SimViewMode = "network" | "follow" | "timetable";

type SimModeContextValue = {
  active: boolean;
  playing: boolean;
  multiplier: number;
  /** Elapsed simulated seconds, updated a few times a second for the clock (not every frame). */
  displaySeconds: number;
  viewMode: SimViewMode;
  /**
   * The route `follow` rides and `timetable` tabulates — deliberately *shared* by
   * the two, so switching between them keeps your subject instead of stranding
   * you on some other route. Null means "not chosen yet"; resolve it through
   * `useFocusRoute`, which falls back to the sidebar's active route.
   */
  focusRouteId: string | null;
  /** Convenience for the follow machinery: the focused route, but only while following. */
  followRouteId: string | null;
  enter: () => void;
  exit: () => void;
  togglePlay: () => void;
  setMultiplier: (n: number) => void;
  setViewMode: (mode: SimViewMode) => void;
  setFocusRoute: (routeId: string) => void;
  reset: () => void;
  /** Always-current elapsed simulated seconds; read inside animation frames. */
  simSecondsRef: React.RefObject<number>;
  /** Register a per-frame callback (the vehicle layer uses this); returns an unsubscribe. */
  subscribeFrame: (cb: FrameSubscriber) => () => void;
};

const SimModeContext = createContext<SimModeContextValue | null>(null);

/** "08:00", "13:45" — simulated time of day, wrapping past midnight. */
export function formatSimClock(displaySeconds: number): string {
  const total = Math.floor(START_OF_DAY_SECONDS + displaySeconds) % 86400;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Transient playback state for the simulation overlay — deliberately outside the
 * undo/redo history (like pin mode) since it's UI, not map data. A single rAF
 * loop lives here so simulated time has one source of truth: it advances
 * `simSecondsRef`, fans out to frame subscribers, and only throttles updates to
 * `displaySeconds` so the clock re-renders without churning React every frame.
 */
export function SimModeProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [multiplier, setMultiplierState] = useState(DEFAULT_MULTIPLIER);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [viewMode, setViewModeState] = useState<SimViewMode>("network");
  const [focusRouteId, setFocusRouteId] = useState<string | null>(null);

  const simSecondsRef = useRef(0);
  const playingRef = useRef(playing);
  const multiplierRef = useRef(multiplier);
  const subscribersRef = useRef(new Set<FrameSubscriber>());

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    multiplierRef.current = multiplier;
  }, [multiplier]);

  const subscribeFrame = useCallback((cb: FrameSubscriber) => {
    subscribersRef.current.add(cb);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    let raf = 0;
    let last: number | null = null;
    let lastClock = 0;
    const tick = (ts: number) => {
      if (last !== null && playingRef.current) {
        simSecondsRef.current += ((ts - last) / 1000) * multiplierRef.current;
      }
      last = ts;
      subscribersRef.current.forEach((cb) => cb(simSecondsRef.current));
      if (ts - lastClock > 250) {
        lastClock = ts;
        setDisplaySeconds(simSecondsRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // Esc peels off one layer: from a focused mode back to the network, and only
  // from the network out of the simulation entirely. One enum means this is a
  // single ordinary handler — no capture-phase interception between two
  // providers racing to answer the same key.
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    if (!active) {
      return;
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") {
        return;
      }
      if (viewModeRef.current === "network") {
        setActive(false);
      } else {
        setViewModeState("network");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // The ref keeps the current mode in view without re-binding on every switch.
  }, [active]);

  const reset = useCallback(() => {
    simSecondsRef.current = 0;
    setDisplaySeconds(0);
  }, []);

  const setViewMode = useCallback((mode: SimViewMode) => setViewModeState(mode), []);
  const setFocusRoute = useCallback((routeId: string) => setFocusRouteId(routeId), []);

  // A follow-along run reads as one trip from the origin, so the clock restarts
  // when the *subject* changes — but NOT when you merely step out to the network
  // and back, which would throw away your place every time you glanced away.
  const lastFollowedRef = useRef<string | null>(null);
  useEffect(() => {
    if (viewMode !== "follow" || !focusRouteId || lastFollowedRef.current === focusRouteId) {
      return;
    }
    lastFollowedRef.current = focusRouteId;
    simSecondsRef.current = 0;
    setDisplaySeconds(0);
  }, [viewMode, focusRouteId]);

  const enter = useCallback(() => {
    setActive(true);
    setPlaying(true);
    setViewModeState("network");
    lastFollowedRef.current = null;
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    setViewModeState("network");
  }, []);
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const setMultiplier = useCallback((n: number) => setMultiplierState(n), []);

  const value = useMemo(
    () => ({
      active,
      playing,
      multiplier,
      displaySeconds,
      viewMode,
      focusRouteId,
      followRouteId: viewMode === "follow" ? focusRouteId : null,
      enter,
      exit,
      togglePlay,
      setMultiplier,
      setViewMode,
      setFocusRoute,
      reset,
      simSecondsRef,
      subscribeFrame,
    }),
    [
      active,
      playing,
      multiplier,
      displaySeconds,
      viewMode,
      focusRouteId,
      enter,
      exit,
      togglePlay,
      setMultiplier,
      setViewMode,
      setFocusRoute,
      reset,
      subscribeFrame,
    ]
  );

  return <SimModeContext.Provider value={value}>{children}</SimModeContext.Provider>;
}

export function useSimMode(): SimModeContextValue {
  const context = useContext(SimModeContext);
  if (!context) {
    throw new Error("useSimMode must be used within a SimModeProvider");
  }
  return context;
}
