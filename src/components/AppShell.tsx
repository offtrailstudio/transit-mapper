"use client";

import { useState } from "react";
import { MapProvider } from "react-map-gl/mapbox";
import { PinModeProvider } from "../context/PinModeContext";
import { SimModeProvider } from "../context/SimModeContext";
import { MobileTopBar } from "./MobileTopBar";
import { FollowBanner } from "./sim/FollowBanner";
import { FollowRoutePicker } from "./sim/FollowRoutePicker";
import { SimControls } from "./sim/SimControls";
import { TimetableView } from "./timetable/TimetableView";
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
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <MapProvider>
      <PinModeProvider>
      <SimModeProvider>
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
          <FollowBanner />
          <FollowRoutePicker />
          <SimControls />
          <TimetableView />
        </main>

        {rail}
      </div>
      </SimModeProvider>
      </PinModeProvider>
    </MapProvider>
  );
}
