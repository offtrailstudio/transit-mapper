"use client";

import { useState } from "react";
import { MapProvider } from "react-map-gl/mapbox";
import { PinModeProvider } from "../context/PinModeContext";
import { PrintModeProvider, usePrintMode } from "../context/PrintModeContext";
import { SimModeProvider } from "../context/SimModeContext";
import { MobileTopBar } from "./MobileTopBar";
import { FollowBanner } from "./sim/FollowBanner";
import { FollowRoutePicker } from "./sim/FollowRoutePicker";
import { SimControls } from "./sim/SimControls";
import { ViewModeMenu } from "./sim/ViewModeMenu";
import { TimetableView } from "./timetable/TimetableView";
import { PrintSheetProvider } from "../hooks/usePrintSheet";
import { PrintPreview } from "./print/PrintPreview";
import { Sidebar } from "./sidebar/Sidebar";

/**
 * The editor shell. `rail` is the host-composed toolbar (see `rail/AppRail`) and
 * `mobileNav` is the host's mobile "all maps" button: the shell owns the
 * map/sidebar/sim/timetable layout but not which tools appear or where they
 * navigate, so an embedder supplies its own without the shell importing app/cloud
 * code.
 */
export function AppShell({
  children,
  rail,
  mobileNav,
}: {
  children: React.ReactNode;
  rail: React.ReactNode;
  mobileNav?: React.ReactNode;
}) {
  return (
    <MapProvider>
      <PinModeProvider>
      <SimModeProvider>
      <PrintModeProvider>
      <PrintSheetProvider>
        <ShellLayout rail={rail} mobileNav={mobileNav}>{children}</ShellLayout>
      </PrintSheetProvider>
      </PrintModeProvider>
      </SimModeProvider>
      </PinModeProvider>
    </MapProvider>
  );
}

/** The layout proper, inside the providers so it can react to print mode. */
function ShellLayout({
  children,
  rail,
  mobileNav,
}: {
  children: React.ReactNode;
  rail: React.ReactNode;
  mobileNav?: React.ReactNode;
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { isPrinting } = usePrintMode();

  return (
    <>
      {/* Mobile: a vertical column of floating cards — title bar, map, toolkit row. Desktop (md+): the classic three columns. Both get exterior padding + gaps so the panels read as cards on the page. (md keeps its historical flush edges between the two.) */}
      {/* h-dvh (dynamic viewport), not h-screen/100vh: on mobile 100vh measures the viewport with the browser chrome hidden, so the column overflows the visible area and pushes the bottom rail off-screen behind the URL bar. */}
      <div className="flex h-dvh w-screen flex-col gap-3 overflow-hidden p-3 md:flex-row md:gap-0 md:p-0 lg:gap-5 lg:p-5">
        <MobileTopBar
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => setSidebarOpen((open) => !open)}
          allMapsButton={mobileNav}
        />

        <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="relative min-h-0 flex-1 overflow-hidden rounded-xl md:overflow-visible md:rounded-none lg:overflow-hidden lg:rounded-xl">
          {children}
          {!isPrinting && <TimetableView />}
          {/* Simulation chrome, above the timetable (z-40 over its z-20): the
              view menu top-left, the route being watched top-right, the clock's
              transport along the bottom. */}
          {!isPrinting && (
            <>
              <div className="pointer-events-none absolute left-4 top-4 z-40 flex">
                <div className="pointer-events-auto">
                  <ViewModeMenu />
                </div>
              </div>
              <FollowBanner />
              <FollowRoutePicker />
              <SimControls />
            </>
          )}
          {isPrinting && <PrintPreview />}
        </main>

        {rail}
      </div>
    </>
  );
}
