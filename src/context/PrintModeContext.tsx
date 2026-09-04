"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { BasemapStyle } from "../lib/basemap";
import {
  DEFAULT_PRINT_SIZE_ID,
  LABEL_FONT_SIZE_PX,
  type LayoutMode,
  type PrintSizeId,
} from "../lib/exportGeometry";

export type ImageFormat = "png" | "svg";
export type BackgroundOption = "plain" | BasemapStyle;

/**
 * Everything the print view lets you change about the sheet. One object rather
 * than loose state because the rail opens print mode, the sidebar panel edits
 * these, and the preview in the middle renders them — three places that would
 * otherwise each need their own copy.
 */
export type PrintSettings = {
  format: ImageFormat;
  mode: LayoutMode;
  background: BackgroundOption;
  sizeId: PrintSizeId;
  labelFontSizePx: number;
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  format: "png",
  mode: "geographic",
  background: "plain",
  sizeId: DEFAULT_PRINT_SIZE_ID,
  labelFontSizePx: LABEL_FONT_SIZE_PX,
};

/** How far the label size can be dialled, as a share of the default. */
export const LABEL_SIZE_RANGE = { min: 0.6, max: 1.8, step: 0.1 } as const;

export function clampLabelFontSize(px: number): number {
  const min = LABEL_FONT_SIZE_PX * LABEL_SIZE_RANGE.min;
  const max = LABEL_FONT_SIZE_PX * LABEL_SIZE_RANGE.max;
  return Math.round(Math.min(max, Math.max(min, px)));
}

type PrintModeContextValue = {
  isPrinting: boolean;
  open: () => void;
  close: () => void;
  settings: PrintSettings;
  update: (patch: Partial<PrintSettings>) => void;
  reset: () => void;
  /** The stop whose label is being adjusted, if any. View state — the override it edits is map data. */
  selectedStopId: string | null;
  selectStop: (stopId: string | null) => void;
};

const PrintModeContext = createContext<PrintModeContextValue | null>(null);

export function PrintModeProvider({ children }: { children: React.ReactNode }) {
  const [isPrinting, setPrinting] = useState(false);
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  const open = useCallback(() => setPrinting(true), []);
  const close = useCallback(() => {
    setPrinting(false);
    // The selection is about the sheet, not the map; leaving it set would put a
    // stale highlight on whatever is selected next time print mode opens.
    setSelectedStopId(null);
  }, []);
  const selectStop = useCallback((stopId: string | null) => setSelectedStopId(stopId), []);
  // Settings deliberately survive closing the view: someone who tuned a sheet,
  // went back to fix a stop, and reopened print would otherwise lose the lot.
  const reset = useCallback(() => setSettings(DEFAULT_PRINT_SETTINGS), []);
  const update = useCallback(
    (patch: Partial<PrintSettings>) => setSettings((current) => ({ ...current, ...patch })),
    []
  );

  const value = useMemo(
    () => ({ isPrinting, open, close, settings, update, reset, selectedStopId, selectStop }),
    [isPrinting, open, close, settings, update, reset, selectedStopId, selectStop]
  );

  return <PrintModeContext.Provider value={value}>{children}</PrintModeContext.Provider>;
}

export function usePrintMode(): PrintModeContextValue {
  const value = useContext(PrintModeContext);
  if (!value) {
    throw new Error("usePrintMode must be used within a PrintModeProvider");
  }
  return value;
}
