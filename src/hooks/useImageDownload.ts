"use client";

import { useState } from "react";
import { useEditorConfig } from "../context/ConfigContext";
import { useMapData } from "../context/MapDataContext";
import { basemapStaticUrl, fetchBasemapDataUri, type BasemapStyle } from "../lib/basemap";
import { downloadBlob } from "../lib/download";
import { computeExportLayout, DEFAULT_PRINT_SIZE_ID, type LayoutMode } from "../lib/exportGeometry";
import { svgToPngBlob } from "../lib/exportRaster";
import { buildExportSvg } from "../lib/exportSvg";

export type ImageFormat = "png" | "svg";
export type BackgroundOption = "plain" | BasemapStyle;

// A basemap only aligns in geographic mode (schematic redraws geography), and
// needs a Mapbox token to fetch. Anywhere else, the choice is silently ignored.
export function basemapAvailable(mode: LayoutMode, mapboxToken: string | undefined): boolean {
  return mode === "geographic" && Boolean(mapboxToken);
}

/** Shared by the desktop right rail and the mobile sidebar bar, which offer the same export in different shells. */
export function useImageDownload() {
  const { mapboxToken } = useEditorConfig();
  const { state } = useMapData();
  const [format, setFormat] = useState<ImageFormat>("png");
  const [mode, setMode] = useState<LayoutMode>("geographic");
  const [background, setBackground] = useState<BackgroundOption>("plain");
  const [isDownloading, setIsDownloading] = useState(false);

  async function download() {
    setIsDownloading(true);
    try {
      const layout = computeExportLayout(state.data, DEFAULT_PRINT_SIZE_ID, mode);

      let basemapHref: string | undefined;
      if (background !== "plain" && basemapAvailable(mode, mapboxToken) && layout.geoBounds) {
        try {
          const url = basemapStaticUrl(layout.geoBounds, {
            style: background,
            widthPx: layout.widthPx,
            heightPx: layout.heightPx,
            token: mapboxToken!,
          });
          basemapHref = await fetchBasemapDataUri(url);
        } catch {
          // A failed basemap fetch shouldn't sink the export — fall back to plain.
          basemapHref = undefined;
        }
      }

      const svg = buildExportSvg(layout, { basemapHref });

      if (format === "svg") {
        downloadBlob(
          new Blob([svg], { type: "image/svg+xml" }),
          `transit-map-${DEFAULT_PRINT_SIZE_ID}.svg`
        );
        return;
      }

      const blob = await svgToPngBlob(svg, layout.widthPx, layout.heightPx);
      downloadBlob(blob, `transit-map-${DEFAULT_PRINT_SIZE_ID}.png`);
    } finally {
      setIsDownloading(false);
    }
  }

  return {
    format,
    setFormat,
    mode,
    setMode,
    background,
    setBackground,
    isDownloading,
    download,
  };
}
