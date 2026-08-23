"use client";

import { useState } from "react";
import { Pause, Play, RotateCcw, Settings } from "lucide-react";
import { formatSimClock, useSimMode } from "../../context/SimModeContext";
import { SimSettingsModal } from "./SimSettingsModal";
import { SpeedMenu } from "./SpeedMenu";

/**
 * The playback bar (desktop + mobile), always on screen: the simulation is never
 * off, only paused, so this is the transport for a clock that's always there.
 * Playback only — which of the three views is showing is picked by the
 * `ViewModeMenu` pill in the map's top-left, so the bar stays the clock's
 * transport and the mode sits with the map it changes.
 */
export function SimControls() {
  const { playing, displaySeconds, togglePlay, reset } = useSimMode();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full bg-neutral-900/90 px-3 py-2 text-white shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="rounded-full bg-white/15 p-2 hover:bg-white/25"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <span className="tabular-nums font-medium" aria-label="Simulated time">
          {formatSimClock(displaySeconds)}
        </span>

        <SpeedMenu />

        <button
          type="button"
          onClick={reset}
          aria-label="Reset clock"
          className="rounded-full bg-white/15 p-2 hover:bg-white/25"
        >
          <RotateCcw size={16} />
        </button>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Simulation settings"
          title="Simulation settings"
          className="rounded-full bg-white/15 p-2 hover:bg-white/25"
        >
          <Settings size={16} />
        </button>
      </div>

      <SimSettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
