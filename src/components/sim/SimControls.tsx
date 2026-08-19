"use client";

import { useState } from "react";
import { Map, Pause, Play, RotateCcw, Settings, Table, X } from "lucide-react";
import { formatSimClock, useSimMode } from "../../context/SimModeContext";
import { useTimetableMode } from "../../context/TimetableModeContext";
import { SimSettingsModal } from "./SimSettingsModal";
import { SpeedMenu } from "./SpeedMenu";

/** Bottom overlay bar shown while the simulation is running (desktop + mobile). */
export function SimControls() {
  const { active, playing, displaySeconds, togglePlay, reset, exit } = useSimMode();
  const { active: showingTimetable, enter: showTimetable, exit: showMap } = useTimetableMode();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!active) {
    return null;
  }

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
          onClick={showingTimetable ? showMap : showTimetable}
          aria-label={showingTimetable ? "Show map" : "Show timetable"}
          title={showingTimetable ? "Show map" : "Show timetable"}
          className="rounded-full bg-white/15 p-2 hover:bg-white/25"
        >
          {showingTimetable ? <Map size={16} /> : <Table size={16} />}
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

        <button
          type="button"
          onClick={exit}
          aria-label="Exit simulation"
          title="Exit (Esc)"
          className="rounded-full bg-white/15 p-2 hover:bg-white/25"
        >
          <X size={16} />
        </button>
      </div>

      <SimSettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
