"use client";

import { Modal } from "../Modal";
import { useEditorConfig } from "../../context/ConfigContext";
import {
  basemapAvailable,
  useImageDownload,
  type BackgroundOption,
  type ImageFormat,
} from "../../hooks/useImageDownload";
import type { LayoutMode } from "../../lib/exportGeometry";

const FORMATS: { id: ImageFormat; label: string; hint: string }[] = [
  { id: "png", label: "png", hint: "Best for printing or sharing." },
  { id: "svg", label: "svg", hint: "Vector — stays editable and sharp at any size." },
];

const STYLES: { id: LayoutMode; label: string; hint: string }[] = [
  { id: "geographic", label: "geographic", hint: "True to real positions." },
  { id: "schematic", label: "schematic", hint: "Redrawn as a clean diagram — evenly spaced stops and straight 45° routes, like a classic subway map. Best for busy networks." },
];

const BACKGROUNDS: { id: BackgroundOption; label: string; hint: string }[] = [
  { id: "plain", label: "plain", hint: "A clean white sheet." },
  { id: "light", label: "map", hint: "A real basemap behind the routes — land and water in different tones, like a printed transit map." },
  { id: "dark", label: "map (dark)", hint: "The same basemap on a dark sheet." },
];

export function ExportImageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mapboxToken } = useEditorConfig();
  const { format, setFormat, mode, setMode, background, setBackground, isDownloading, download } =
    useImageDownload();
  const active = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const activeStyle = STYLES.find((s) => s.id === mode) ?? STYLES[0];
  const activeBackground = BACKGROUNDS.find((b) => b.id === background) ?? BACKGROUNDS[0];
  // The basemap only aligns in geographic mode (and needs a Mapbox token).
  const canUseBasemap = basemapAvailable(mode, mapboxToken);

  async function handleDownload() {
    await download();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Export image">
      <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
        Renders a print-ready picture of the map at 18 × 24 in. This is the finished
        artwork, not an editable file — use Save for that.
      </p>

      <div className="mb-2 flex gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
        {STYLES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setMode(option.id);
              // A basemap only fits geographic mode; drop it when leaving.
              if (!basemapAvailable(option.id, mapboxToken)) setBackground("plain");
            }}
            aria-pressed={mode === option.id}
            className={`flex-1 rounded px-2 py-1.5 font-mono text-sm ${
              mode === option.id
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-neutral-500">{activeStyle.hint}</p>

      <div className="mb-2 flex gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
        {BACKGROUNDS.map((option) => {
          const disabled = option.id !== "plain" && !canUseBasemap;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setBackground(option.id)}
              aria-pressed={background === option.id}
              disabled={disabled}
              className={`flex-1 rounded px-2 py-1.5 font-mono text-xs ${
                background === option.id
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-neutral-600`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-xs text-neutral-500">
        {canUseBasemap
          ? activeBackground.hint
          : "The map background needs geographic mode."}
      </p>

      <div className="mb-2 flex gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
        {FORMATS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFormat(option.id)}
            aria-pressed={format === option.id}
            className={`flex-1 rounded px-2 py-1.5 font-mono text-sm ${
              format === option.id
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-neutral-500">{active.hint}</p>

      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
      >
        {isDownloading ? "Downloading…" : "Download"}
      </button>
    </Modal>
  );
}
