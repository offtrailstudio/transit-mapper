"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useMapData } from "../../context/MapDataContext";
import { PresetRoutesModal } from "./PresetLinesModal";

/**
 * A split button, because drawing your own route is the common case: the wide
 * segment does it in one click, and presets stay one click away in the second
 * segment rather than competing for space as a second full-width button.
 *
 * That segment shows an ellipsis rather than a caret on purpose — a caret promises
 * a dropdown, and the 39-route preset catalogue needs a modal to be browsable.
 */
export function AddRouteButton() {
  const { dispatch } = useMapData();
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  return (
    <>
      <div className="flex w-full">
        <button
          type="button"
          onClick={() => dispatch({ type: "ADD_ROUTE" })}
          className="flex-1 rounded-l-md bg-neutral-900 px-3 py-2 text-base font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          + New Route
        </button>
        <span className="w-px bg-neutral-700 dark:bg-neutral-300" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setIsPresetsOpen(true)}
          aria-label="Add a preset route"
          title="Add a preset route"
          className="rounded-r-md bg-neutral-900 px-2 py-2 text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      <PresetRoutesModal open={isPresetsOpen} onClose={() => setIsPresetsOpen(false)} />
    </>
  );
}
