"use client";

import { useState } from "react";
import { Modal } from "../Modal";
import { useMapData } from "../../context/MapDataContext";
import { findPresetMergeCandidates, StationMergeCandidate } from "../../lib/presetMerge";
import { groupPresetRoutes, PRESET_GROUPS, PRESET_LINES, PresetRoute } from "../../lib/presets";
import { MergeStationsModal } from "./MergeStationsModal";

export function PresetRoutesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useMapData();
  const grouped = groupPresetRoutes(PRESET_LINES, PRESET_GROUPS);
  const [pending, setPending] = useState<{
    preset: PresetRoute;
    candidates: StationMergeCandidate[];
  } | null>(null);

  function selectPreset(preset: PresetRoute) {
    const candidates = findPresetMergeCandidates(state.data.stops, preset.stops);
    if (candidates.length === 0) {
      dispatch({ type: "ADD_PRESET_ROUTE", preset });
      onClose();
      return;
    }
    setPending({ preset, candidates });
  }

  function confirmMerge(merges: Record<number, string>) {
    if (!pending) {
      return;
    }
    dispatch({ type: "ADD_PRESET_ROUTE", preset: pending.preset, merges });
    setPending(null);
    onClose();
  }

  if (pending) {
    return (
      <MergeStationsModal
        key={pending.preset.id}
        open={open}
        preset={pending.preset}
        candidates={pending.candidates}
        onBack={() => setPending(null)}
        onConfirm={confirmMerge}
        onClose={() => {
          setPending(null);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a preset route">
      <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
        Add a real-world transit route to this map as a starting point. Its stations are added
        alongside whatever&apos;s already here.
      </p>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {grouped.map(({ group, routes }) => (
          <div key={group?.id ?? "ungrouped"}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {group?.name ?? "Other"}
            </h3>
            <ul className="space-y-1.5">
              {routes.map((preset) => (
                <li key={preset.id}>
                  <button
                    type="button"
                    onClick={() => selectPreset(preset)}
                    className="flex w-full items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-left hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: preset.color ?? "#999" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium text-neutral-900 dark:text-white">
                        {preset.name}
                      </span>
                      {preset.description && (
                        <span className="block truncate text-xs text-neutral-500">
                          {preset.description}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {preset.stops.length} stops
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}
