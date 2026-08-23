"use client";

import { useSimMode } from "../../context/SimModeContext";
import { RoutePicker } from "../timetable/RoutePicker";

/**
 * The route being followed, parked in the map's top-right — the same corner the
 * timetable puts its own picker in, so "which route am I looking at" lives in one
 * place no matter which focused mode you're in.
 *
 * Deliberately not nested inside the view menu opposite it: changing route would
 * then mean reopening that menu and walking into a submenu, and mode and subject
 * would be fused back into the single control that made leaving Follow hard to
 * find.
 */
export function FollowRoutePicker() {
  const { viewMode } = useSimMode();

  if (viewMode !== "follow") {
    return null;
  }

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-40 flex justify-end">
      <div className="pointer-events-auto">
        <RoutePicker tone="overlay" />
      </div>
    </div>
  );
}
