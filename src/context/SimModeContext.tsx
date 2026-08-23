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
  /**
   * True while the simulation owns the map, so map editing steps aside: the clock
   * is running, or a focused mode has taken the camera/screen. Paused on the
   * network view is the editing state — that's the editor's resting position.
   */
  editingLocked: boolean;
  togglePlay: () => void;
  setMultiplier: (n: number) => void;
  setViewMode: (mode: SimViewMode) => void;
  setFocusRoute: (routeId: string) => void;
  reset: () => void;
  /** Always-current elapsed simulated seconds; read inside animation frames. */
  simSecondsRef: React.RefObject<number>;
  /** Register a per-frame callback (the vehicle layer uses this); returns an unsubscribe. */
  subscribeFrame: (cb: FrameSubscriber) => () => void;
  /**
   * Push the current clock to every subscriber out of band. The rAF loop only
   * runs while playing, so anything that moves the vehicles *while paused* — a
   * reset, a change of followed route — has to repaint them itself.
   */
  publishFrame: () => void;
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
 * Playback state for the simulation, which is always mounted: the editor opens
 * with the sim paused on the network view, and pressing play is what hands the
 * map over to it. (Transient, and deliberately outside the undo/redo history
 * like pin mode — it's UI, not map data.)
 *
 * The rAF loop lives here so simulated time has one source of truth: it advances
 * `simSecondsRef`, fans out to frame subscribers, and only throttles updates to
 * `displaySeconds` so the clock re-renders without churning React every frame.
 * It runs only while playing — a paused editor must not burn a frame callback
 * sixty times a second — so out-of-band moves go through `publishFrame`.
 */
export function SimModeProvider({ children }: { children: React.ReactNode }) {
  const [playing, setPlaying] = useState(false);
  const [multiplier, setMultiplierState] = useState(DEFAULT_MULTIPLIER);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [viewMode, setViewModeState] = useState<SimViewMode>("network");
  const [focusRouteId, setFocusRouteId] = useState<string | null>(null);

  const simSecondsRef = useRef(0);
  const multiplierRef = useRef(multiplier);
  const subscribersRef = useRef(new Set<FrameSubscriber>());

  useEffect(() => {
    multiplierRef.current = multiplier;
  }, [multiplier]);

  const subscribeFrame = useCallback((cb: FrameSubscriber) => {
    subscribersRef.current.add(cb);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  const publishFrame = useCallback(() => {
    subscribersRef.current.forEach((cb) => cb(simSecondsRef.current));
  }, []);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let raf = 0;
    let last: number | null = null;
    let lastClock = 0;
    const tick = (ts: number) => {
      if (last !== null) {
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
  }, [playing]);

  // Esc peels off one layer: a focused mode hands the map back to the network
  // view. There's no layer below that to leave — the simulation is always
  // mounted — so Esc on the network is a no-op rather than a hidden exit.
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || viewModeRef.current === "network") {
        return;
      }
      setViewModeState("network");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // The ref keeps the current mode in view without re-binding on every switch.
  }, []);

  const reset = useCallback(() => {
    simSecondsRef.current = 0;
    setDisplaySeconds(0);
    publishFrame();
  }, [publishFrame]);

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
    publishFrame();
  }, [viewMode, focusRouteId, publishFrame]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const setMultiplier = useCallback((n: number) => setMultiplierState(n), []);

  const editingLocked = playing || viewMode !== "network";

  const value = useMemo(
    () => ({
      playing,
      multiplier,
      displaySeconds,
      viewMode,
      focusRouteId,
      followRouteId: viewMode === "follow" ? focusRouteId : null,
      editingLocked,
      togglePlay,
      setMultiplier,
      setViewMode,
      setFocusRoute,
      reset,
      simSecondsRef,
      subscribeFrame,
      publishFrame,
    }),
    [
      playing,
      multiplier,
      displaySeconds,
      viewMode,
      focusRouteId,
      editingLocked,
      togglePlay,
      setMultiplier,
      setViewMode,
      setFocusRoute,
      reset,
      subscribeFrame,
      publishFrame,
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
