"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Modal } from "../Modal";
import { StationMergeCandidate } from "../../lib/presetMerge";
import { ResolvedRoute } from "../../lib/presets";

export function MergeStationsModal({
  open,
  preset,
  candidates,
  onBack,
  onConfirm,
  onClose,
}: {
  open: boolean;
  preset: ResolvedRoute;
  candidates: StationMergeCandidate[];
  onBack: () => void;
  onConfirm: (merges: Record<number, string>) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(candidates.map((c) => c.stopIndex))
  );

  function toggle(stopIndex: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stopIndex)) {
        next.delete(stopIndex);
      } else {
        next.add(stopIndex);
      }
      return next;
    });
  }

  function confirm() {
    const merges: Record<number, string> = {};
    for (const candidate of candidates) {
      if (selected.has(candidate.stopIndex)) {
        merges[candidate.stopIndex] = candidate.existingStop.id;
      }
    }
    onConfirm(merges);
  }

  const shared = candidates.length;

  return (
    <Modal open={open} onClose={onClose} title="Merge shared stations">
      <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
        {preset.name} passes through {shared} station{shared === 1 ? "" : "s"} already on your map.
        Checked stops reuse the existing station instead of adding a duplicate.
      </p>

      <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
        {candidates.map((candidate) => {
          const checked = selected.has(candidate.stopIndex);
          return (
            <li key={candidate.stopIndex}>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-neutral-300 px-3 py-2 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(candidate.stopIndex)}
                  className="mt-1 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-white">
                    <span className="min-w-0 flex-1 truncate" title={candidate.stop.name}>
                      {candidate.stop.name}
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate" title={candidate.existingStop.name}>
                      {candidate.existingStop.name}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                    <span className="min-w-0 flex-1 truncate">New stop</span>
                    <span className="w-[14px] shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      On map · {Math.round(candidate.distanceMeters)} m away
                    </span>
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Back
        </button>
        <button
          type="button"
          onClick={confirm}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Add route
        </button>
      </div>
    </Modal>
  );
}
