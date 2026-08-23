"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SIM_MULTIPLIERS, useSimMode } from "../../context/SimModeContext";

/** A single button showing the current playback speed; tapping it opens the options. */
export function SpeedMenu() {
  const { multiplier, setMultiplier } = useSimMode();
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Playback speed"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 items-center gap-0.5 rounded-full bg-white/15 pl-3 pr-2 text-xs font-medium hover:bg-white/25"
      >
        {multiplier}×
        <ChevronDown size={13} />
      </button>

      {open && (
        <div
          role="menu"
          // mb-4 to clear the bar's own py-2 — matches ViewModeMenu, so the two
          // menus in this bar don't float at different heights.
          className="absolute bottom-full left-1/2 mb-4 flex -translate-x-1/2 flex-col gap-0.5 rounded-lg bg-neutral-900/95 p-1 shadow-lg backdrop-blur"
        >
          {SIM_MULTIPLIERS.map((m) => (
            <button
              key={m}
              type="button"
              role="menuitemradio"
              aria-checked={multiplier === m}
              onClick={() => {
                setMultiplier(m);
                setOpen(false);
              }}
              className={`rounded-md px-4 py-1 text-xs font-medium ${
                multiplier === m ? "bg-white text-neutral-900" : "text-white hover:bg-white/20"
              }`}
            >
              {m}×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
