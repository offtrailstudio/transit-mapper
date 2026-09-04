"use client";

import { Printer, Redo2, Undo2 } from "lucide-react";
import { useMapData } from "../../context/MapDataContext";
import { usePrintMode } from "../../context/PrintModeContext";
import { Tooltip } from "../Tooltip";
import { RAIL_ASIDE, RAIL_BUTTON, RAIL_ICON_SIZE } from "./railStyles";

/**
 * Editor-intrinsic rail building blocks. These are the tools the editor owns
 * regardless of who's hosting it — undo/redo/export plus the shell chrome. (No
 * simulation controls: the simulation is always running, so its view menu and
 * playback bar live over the map instead.) The *host* composes these with its
 * own buttons (nav, save, share, account…) into an `EditorRail`/`SharedRail`
 * and passes the result to `AppShell`'s `rail` prop, so the package never
 * imports app/cloud code.
 */

/** The rail column/row wrapper. A vertical column at `md`+, a scrollable row below it. */
export function RailShell({ children }: { children: React.ReactNode }) {
  return <aside className={RAIL_ASIDE}>{children}</aside>;
}

/** The thin separator between the nav button and the tools (desktop-only). */
export function RailTopDivider() {
  return <span className="hidden bg-neutral-300 dark:bg-neutral-700 md:my-1 md:block md:h-px md:w-8" />;
}

/** The separator between tool groups (visible in both the mobile row and desktop column). */
export function RailDivider() {
  return (
    <span className="mx-1 h-8 w-px shrink-0 bg-neutral-300 dark:bg-neutral-700 md:mx-0 md:my-1 md:h-px md:w-8" />
  );
}

export function UndoButton() {
  const { canUndo, undo } = useMapData();
  return (
    <Tooltip label="Undo (Ctrl/Cmd+Z)">
      <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo" className={RAIL_BUTTON}>
        <Undo2 size={RAIL_ICON_SIZE} />
      </button>
    </Tooltip>
  );
}

export function RedoButton() {
  const { canRedo, redo } = useMapData();
  return (
    <Tooltip label="Redo (Ctrl/Cmd+Shift+Z)">
      <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo" className={RAIL_BUTTON}>
        <Redo2 size={RAIL_ICON_SIZE} />
      </button>
    </Tooltip>
  );
}

/** Print/export — self-contained: owns the modal it opens. */
export function ExportButton() {
  const { isPrinting, open, close } = usePrintMode();
  return (
    <Tooltip label={isPrinting ? "Back to editing" : "Export image for print"}>
      <button
        type="button"
        onClick={() => (isPrinting ? close() : open())}
        aria-label="Export image"
        aria-pressed={isPrinting}
        className={`${RAIL_BUTTON} ${
          isPrinting ? "bg-neutral-900 text-white hover:bg-neutral-900 hover:text-white dark:bg-white dark:text-neutral-900" : ""
        }`}
      >
        <Printer size={RAIL_ICON_SIZE} />
      </button>
    </Tooltip>
  );
}
