"use client";

import { Eye, EyeOff, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { useMapData } from "../../context/MapDataContext";
import { usePrintMode } from "../../context/PrintModeContext";
import { usePrintSheet } from "../../hooks/usePrintSheet";
import { normalizeLabelAngle } from "../../lib/migrate";

/**
 * Per-stop label overrides for whichever stop is selected in the preview.
 *
 * These write to the *map*, not to print settings: a hand-placed label has to
 * survive a reload and sit under undo/redo, which a view-state setting wouldn't.
 */
export function SelectedStopControls() {
  const { state, dispatch, readOnly } = useMapData();
  const { selectedStopId, selectStop } = usePrintMode();
  const { layout } = usePrintSheet();

  const stop = state.data.stops.find((s) => s.id === selectedStopId);
  if (!stop) {
    return (
      <p className="rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-500 dark:border-neutral-700">
        Click a stop on the sheet to move or hide its name.
      </p>
    );
  }

  const override = state.data.labelOverrides?.[stop.id];
  const hidden = override?.hidden ?? false;
  const angle = override?.angle;
  // Where the label actually is on the sheet, whoever put it there. Rotating
  // from the placer's own choice means the first click nudges the label round by
  // 45° instead of teleporting it to some arbitrary starting bearing.
  const current = angle ?? layout.stations.find((s) => s.id === stop.id)?.labelAngle ?? 90;

  const rotate = (delta: number) =>
    dispatch({
      type: "SET_LABEL_OVERRIDE",
      stopId: stop.id,
      // Rotating a hidden label would do nothing visible, so bring it back too.
      override: { angle: normalizeLabelAngle(current + delta), hidden: false },
    });

  return (
    <div className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium" title={stop.name}>
          {stop.name || "Unnamed stop"}
        </span>
        <button
          type="button"
          onClick={() => selectStop(null)}
          className="shrink-0 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          Done
        </button>
      </div>

      {readOnly ? (
        <p className="text-xs text-neutral-500">Read-only on a shared map.</p>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => rotate(-45)}
              aria-label="Rotate label anticlockwise"
              disabled={hidden}
              className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-200 disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={() => rotate(45)}
              aria-label="Rotate label clockwise"
              disabled={hidden}
              className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-200 disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <RotateCw size={14} />
            </button>

            <button
              type="button"
              onClick={() =>
                dispatch({ type: "SET_LABEL_OVERRIDE", stopId: stop.id, override: { hidden: !hidden } })
              }
              aria-label={hidden ? "Show label" : "Hide label"}
              aria-pressed={hidden}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${
                hidden
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              {hidden ? "Hidden" : "Hide"}
            </button>

            {override && (
              <button
                type="button"
                onClick={() => dispatch({ type: "CLEAR_LABEL_OVERRIDE", stopId: stop.id })}
                aria-label="Reset label to automatic"
                className="ml-auto rounded-md border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Undo2 size={14} />
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-neutral-500">
            {hidden
              ? "The stop still prints — as a smaller dot, with no name."
              : angle === undefined
                ? `Placed automatically at ${current}°. Rotating steps it round the stop by 45°.`
                : `Placed by hand at ${angle}°.`}
          </p>
        </>
      )}
    </div>
  );
}
