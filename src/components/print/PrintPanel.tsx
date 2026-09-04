"use client";

import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useEditorConfig } from "../../context/ConfigContext";
import { useMapData } from "../../context/MapDataContext";
import {
  clampLabelFontSize,
  LABEL_SIZE_RANGE,
  usePrintMode,
  type BackgroundOption,
  type ImageFormat,
} from "../../context/PrintModeContext";
import { basemapAvailable, usePrintSheet } from "../../hooks/usePrintSheet";
import { LABEL_FONT_SIZE_PX, PRINT_SIZES, type LayoutMode } from "../../lib/exportGeometry";
import { SelectedStopControls } from "./SelectedStopControls";

const STYLES: { id: LayoutMode; label: string; hint: string }[] = [
  { id: "geographic", label: "geographic", hint: "True to real positions." },
  {
    id: "schematic",
    label: "schematic",
    hint: "Redrawn as a clean diagram — evenly spaced stops and straight 45° routes, like a classic subway map. Best for busy networks.",
  },
];

const BACKGROUNDS: { id: BackgroundOption; label: string; hint: string }[] = [
  { id: "plain", label: "plain", hint: "A clean white sheet." },
  {
    id: "light",
    label: "map",
    hint: "A real basemap behind the routes — land and water in different tones, like a printed transit map.",
  },
  { id: "dark", label: "map (dark)", hint: "The same basemap on a dark sheet." },
];

const FORMATS: { id: ImageFormat; label: string; hint: string }[] = [
  { id: "png", label: "png", hint: "Best for printing or sharing." },
  { id: "svg", label: "svg", hint: "Vector — stays editable and sharp at any size." },
];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</h3>
      {children}
      {hint && <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

/** A segmented control. Generic so each row keeps its own option id type. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabledIds,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  disabledIds?: T[];
}) {
  return (
    <div className="flex gap-1 rounded-md bg-neutral-200/70 p-1 dark:bg-neutral-800">
      {options.map((option) => {
        const disabled = disabledIds?.includes(option.id) ?? false;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            disabled={disabled}
            className={`flex-1 rounded px-2 py-1.5 font-mono text-xs ${
              value === option.id
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-neutral-600`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The print view's toolbar, which takes over the sidebar while printing. Every
 * control here re-lays-out the sheet showing in the middle of the screen, so the
 * thing you tune is the thing you download.
 */
export function PrintPanel() {
  const { mapboxToken } = useEditorConfig();
  const { settings, update, close } = usePrintMode();
  const { state, dispatch, readOnly } = useMapData();
  const overrideCount = Object.keys(state.data.labelOverrides ?? {}).length;
  const { canUseBasemap, isDownloading, error, reducedToDpi, download } = usePrintSheet();

  const labelScale = Math.round((settings.labelFontSizePx / LABEL_FONT_SIZE_PX) * 100);
  const stepLabel = (direction: 1 | -1) =>
    update({
      labelFontSizePx: clampLabelFontSize(
        settings.labelFontSizePx + direction * LABEL_FONT_SIZE_PX * LABEL_SIZE_RANGE.step
      ),
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <button
          type="button"
          onClick={close}
          className="-ml-1 flex w-fit items-center gap-1.5 rounded-md px-1 py-1 text-sm text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <ArrowLeft size={15} />
          Back to editing
        </button>

        <Field label="Style" hint={STYLES.find((s) => s.id === settings.mode)?.hint}>
          <Segmented
            options={STYLES}
            value={settings.mode}
            onChange={(mode) => {
              // A basemap only fits geographic mode; drop it when leaving.
              const keepsBasemap = basemapAvailable(mode, mapboxToken);
              update({ mode, ...(keepsBasemap ? {} : { background: "plain" as const }) });
            }}
          />
        </Field>

        <Field
          label="Background"
          hint={
            canUseBasemap
              ? BACKGROUNDS.find((b) => b.id === settings.background)?.hint
              : "The map background needs geographic mode."
          }
        >
          <Segmented
            options={BACKGROUNDS}
            value={settings.background}
            onChange={(background) => update({ background })}
            disabledIds={canUseBasemap ? [] : (["light", "dark"] as BackgroundOption[])}
          />
        </Field>

        <Field label="Paper size">
          <Segmented
            options={PRINT_SIZES.map((size) => ({ id: size.id, label: size.label.replace(/ in$/, "") }))}
            value={settings.sizeId}
            onChange={(sizeId) => update({ sizeId })}
          />
        </Field>

        <Field label="Stop label size" hint="Bigger names claim more room, so the layout re-flows around them.">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepLabel(-1)}
              disabled={labelScale <= LABEL_SIZE_RANGE.min * 100}
              aria-label="Smaller stop labels"
              className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-200 disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <Minus size={14} />
            </button>
            <span className="min-w-12 text-center font-mono text-sm tabular-nums">{labelScale}%</span>
            <button
              type="button"
              onClick={() => stepLabel(1)}
              disabled={labelScale >= LABEL_SIZE_RANGE.max * 100}
              aria-label="Larger stop labels"
              className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-200 disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <Plus size={14} />
            </button>
          </div>
        </Field>

        <Field label="Selected stop">
          <SelectedStopControls />
          {overrideCount > 0 && !readOnly && (
            <button
              type="button"
              onClick={() => dispatch({ type: "CLEAR_ALL_LABEL_OVERRIDES" })}
              className="mt-2 text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:hover:text-white"
            >
              Reset all {overrideCount} hand-placed {overrideCount === 1 ? "label" : "labels"}
            </button>
          )}
        </Field>

        <Field label="File" hint={FORMATS.find((f) => f.id === settings.format)?.hint}>
          <Segmented
            options={FORMATS}
            value={settings.format}
            onChange={(format) => update({ format })}
          />
        </Field>
      </div>

      <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
        {error && (
          <p role="alert" className="mb-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {!error && reducedToDpi && (
          <p className="mb-2 text-xs text-amber-700 dark:text-amber-500">
            Saved at {reducedToDpi} DPI — this browser caps how large an image it can build. Download
            SVG for full resolution.
          </p>
        )}
        <button
          type="button"
          onClick={download}
          disabled={isDownloading}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          {isDownloading ? "Downloading…" : `Download ${settings.format.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}
