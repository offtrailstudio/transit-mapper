"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useEditorConfig } from "../context/ConfigContext";
import { useMapData } from "../context/MapDataContext";
import { usePrintMode } from "../context/PrintModeContext";
import { basemapStaticUrl, fetchBasemapDataUri } from "../lib/basemap";
import { downloadBlob } from "../lib/download";
import { computeExportLayout, EXPORT_DPI, type ExportLayout, type LayoutMode } from "../lib/exportGeometry";
import { svgToPngBlob } from "../lib/exportRaster";
import { buildExportSvg } from "../lib/exportSvg";
import { EMPTY_MAP_DATA } from "../lib/types";

// A basemap only aligns in geographic mode (schematic redraws geography), and
// needs a Mapbox token to fetch. Anywhere else, the choice is silently ignored.
export function basemapAvailable(mode: LayoutMode, mapboxToken: string | undefined): boolean {
  return mode === "geographic" && Boolean(mapboxToken);
}

export type PrintSheet = {
  layout: ExportLayout;
  svg: string;
  canUseBasemap: boolean;
  basemapPending: boolean;
  isDownloading: boolean;
  /** Set when the last download failed, so the panel can say so instead of just resetting. */
  error: string | null;
  /** Set when a PNG had to rasterize below full print resolution to fit the browser's canvas limit. */
  reducedToDpi: number | null;
  download: () => Promise<void>;
};

/**
 * Builds the sheet. Called once, by the provider below — never directly by a
 * component, or the layout would be computed (and the Mapbox raster fetched, and
 * billed) once per consumer.
 */
function useBuildPrintSheet(): PrintSheet {
  const { mapboxToken } = useEditorConfig();
  const { state } = useMapData();
  const { settings, isPrinting } = usePrintMode();
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reducedToDpi, setReducedToDpi] = useState<number | null>(null);

  const canUseBasemap = basemapAvailable(settings.mode, mapboxToken);

  // Geometry is pure, so it only needs recomputing when an input actually
  // changes — it walks every station against every candidate slot, which is not
  // something to redo on an unrelated re-render.
  // Skipped entirely while the print view is closed: placement walks every
  // station against every candidate slot, which is real work on a big network
  // and pointless when there's nothing on screen to show it.
  const layout = useMemo(
    () =>
      computeExportLayout(isPrinting ? state.data : EMPTY_MAP_DATA, settings.sizeId, settings.mode, {
        labelFontSizePx: settings.labelFontSizePx,
      }),
    [isPrinting, state.data, settings.sizeId, settings.mode, settings.labelFontSizePx]
  );

  const basemapUrl =
    settings.background !== "plain" && canUseBasemap && layout.geoBounds
      ? basemapStaticUrl(layout.geoBounds, {
          style: settings.background,
          widthPx: layout.widthPx,
          heightPx: layout.heightPx,
          token: mapboxToken!,
        })
      : null;

  // Cached per URL: dragging the label-size slider re-lays-out constantly but
  // leaves the bounds alone, so the same raster would otherwise be refetched on
  // every frame.
  const cache = useRef(new Map<string, string>());
  const [basemapHref, setBasemapHref] = useState<string | undefined>(undefined);
  const [basemapPending, setBasemapPending] = useState(false);

  useEffect(() => {
    if (!basemapUrl) {
      setBasemapHref(undefined);
      setBasemapPending(false);
      return;
    }
    const cached = cache.current.get(basemapUrl);
    if (cached) {
      setBasemapHref(cached);
      setBasemapPending(false);
      return;
    }

    let cancelled = false;
    setBasemapPending(true);
    fetchBasemapDataUri(basemapUrl)
      .then((uri) => {
        cache.current.set(basemapUrl, uri);
        if (!cancelled) setBasemapHref(uri);
      })
      // A failed basemap fetch shouldn't sink the sheet — fall back to plain.
      .catch(() => {
        if (!cancelled) setBasemapHref(undefined);
      })
      .finally(() => {
        if (!cancelled) setBasemapPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [basemapUrl]);

  const svg = useMemo(
    () => buildExportSvg(layout, { basemapHref: basemapUrl ? basemapHref : undefined }),
    [layout, basemapHref, basemapUrl]
  );

  async function download() {
    setIsDownloading(true);
    setError(null);
    setReducedToDpi(null);
    try {
      const name = `transit-map-${settings.sizeId}`;
      if (settings.format === "svg") {
        downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${name}.svg`);
        return;
      }
      const { blob, scale } = await svgToPngBlob(svg, layout.widthPx, layout.heightPx);
      // A capped browser still gets a file, but it should be told the DPI it got.
      if (scale < 1) setReducedToDpi(Math.round(EXPORT_DPI * scale));
      downloadBlob(blob, `${name}.png`);
    } catch (cause) {
      // Swallowing this is what made a failed export look like nothing happening
      // at all — the button just reset and the user was none the wiser.
      setError(cause instanceof Error ? cause.message : "The download failed.");
    } finally {
      setIsDownloading(false);
    }
  }

  return { layout, svg, canUseBasemap, basemapPending, isDownloading, error, reducedToDpi, download };
}

const PrintSheetContext = createContext<PrintSheet | null>(null);

/** Shares one built sheet with the panel and the preview. */
export function PrintSheetProvider({ children }: { children: React.ReactNode }) {
  const sheet = useBuildPrintSheet();
  return <PrintSheetContext.Provider value={sheet}>{children}</PrintSheetContext.Provider>;
}

export function usePrintSheet(): PrintSheet {
  const sheet = useContext(PrintSheetContext);
  if (!sheet) {
    throw new Error("usePrintSheet must be used within a PrintSheetProvider");
  }
  return sheet;
}
