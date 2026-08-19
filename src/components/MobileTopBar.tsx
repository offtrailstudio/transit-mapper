"use client";

import { Menu } from "lucide-react";
import { useMapData } from "../context/MapDataContext";

/**
 * Mobile-only header. Mirrors the toolkit's height so the map is framed by two
 * equal bars (title on top, tools on the bottom). The title lives in a card; a
 * menu button on its right edge expands the layer sheet. `allMapsButton` — the
 * "all maps" X that sits outside the card — is injected by the host, since where
 * it navigates is app routing, not the editor's concern (on desktop that action
 * is the rail's first button instead).
 */
export function MobileTopBar({
  isMenuOpen,
  onMenuToggle,
  allMapsButton,
}: {
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  allMapsButton?: React.ReactNode;
}) {
  const { state, dispatch, readOnly } = useMapData();

  return (
    <div className="relative z-40 flex h-16 shrink-0 items-center gap-3 md:hidden">
      <div className="flex h-full min-w-0 flex-1 items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-100 pl-2 pr-1 dark:border-neutral-800 dark:bg-neutral-900">
        {readOnly ? (
          <span className="min-w-0 flex-1 truncate px-1 py-1 text-lg font-semibold text-neutral-900 dark:text-white">
            {state.data.title || "Untitled Map"}
          </span>
        ) : (
          <input
            type="text"
            value={state.data.title}
            onChange={(e) => dispatch({ type: "SET_TITLE", title: e.target.value })}
            placeholder="Untitled Map"
            aria-label="Map name"
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-lg font-semibold text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white focus:outline-none dark:text-white dark:placeholder:text-neutral-600 dark:focus:border-neutral-700 dark:focus:bg-neutral-800"
          />
        )}
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Show layers"
          aria-expanded={isMenuOpen}
          className="shrink-0 rounded-lg p-2 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <Menu size={20} />
        </button>
      </div>

      {allMapsButton}
    </div>
  );
}
