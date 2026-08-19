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
const DEFAULT_MULTIPLIER = 5;
/** The simulated clock reads as a time of day, starting from midnight. */
const START_OF_DAY_SECONDS = 0;

type FrameSubscriber = (simSeconds: number) => void;

type SimModeContextValue = {
  active: boolean;
  playing: boolean;
  multiplier: number;
  /** Elapsed simulated seconds, updated a few times a second for the clock (not every frame). */
  displaySeconds: number;
  enter: () => void;
  exit: () => void;
  togglePlay: () => void;
  setMultiplier: (n: number) => void;
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

  useEffect(() => {
    if (!active) {
      return;
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActive(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  const reset = useCallback(() => {
    simSecondsRef.current = 0;
    setDisplaySeconds(0);
  }, []);

  const enter = useCallback(() => {
    setActive(true);
    setPlaying(true);
  }, []);

  const exit = useCallback(() => setActive(false), []);
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const setMultiplier = useCallback((n: number) => setMultiplierState(n), []);

  const value = useMemo(
    () => ({
      active,
      playing,
      multiplier,
      displaySeconds,
      enter,
      exit,
      togglePlay,
      setMultiplier,
      reset,
      simSecondsRef,
      subscribeFrame,
    }),
    [active, playing, multiplier, displaySeconds, enter, exit, togglePlay, setMultiplier, reset, subscribeFrame]
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
