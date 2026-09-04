"use client";

import { useMapData } from "../../context/MapDataContext";
import { usePrintMode } from "../../context/PrintModeContext";
import { Sheet, SheetContent, SheetTitle } from "../ui/sheet";
import { PrintPanel } from "../print/PrintPanel";
import { AddRouteButton } from "./AddLineButton";
import { RouteList } from "./LineList";
import { MapNameRow } from "./MapNameRow";
import { UnassignedStations } from "./UnassignedStations";

/** Shared inner content — the desktop column and the mobile sheet both render this. */
function SidebarBody({ withTitle = false }: { withTitle?: boolean }) {
  const { readOnly } = useMapData();
  const { isPrinting } = usePrintMode();

  // Print mode takes the column over entirely: its controls are what you are
  // working on, and the route list would only compete with the sheet on screen.
  if (isPrinting) {
    return <PrintPanel />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
      {/* On mobile the title lives in the top bar; the desktop column shows it here. */}
      {withTitle && <MapNameRow />}

      <div>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Routes
        </h2>
        <RouteList />
        {!readOnly && (
          <div className="mt-4">
            <AddRouteButton />
          </div>
        )}
      </div>

      <UnassignedStations />
    </div>
  );
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <>
      {/* Desktop (md+): the static left content column. */}
      <aside className="hidden shrink-0 flex-col overflow-hidden bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-white md:flex md:w-80 md:border-r md:border-neutral-200 dark:md:border-neutral-800 lg:rounded-xl lg:border-0">
        <SidebarBody withTitle />
      </aside>

      {/* Below md: the layer list as a shadcn Sheet dropping from behind the top bar,
          inset over the map card (5.5rem = p-3 + the h-16 top bar + gap-3). */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="top"
          aria-describedby={undefined}
          className="inset-x-auto top-[5.5rem] bottom-[5.5rem] left-3 right-3 h-auto gap-0 rounded-xl border border-neutral-200 bg-neutral-100 p-0 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white md:hidden"
        >
          <SheetTitle className="sr-only">Layers</SheetTitle>
          <SidebarBody />
        </SheetContent>
      </Sheet>
    </>
  );
}
