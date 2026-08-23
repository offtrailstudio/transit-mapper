"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState } from "react";
import Map, { MapMouseEvent } from "react-map-gl/mapbox";
import { useEditorConfig } from "../../context/ConfigContext";
import { useMapData } from "../../context/MapDataContext";
import { usePinMode } from "../../context/PinModeContext";
import { useSimMode } from "../../context/SimModeContext";
import { useColorScheme } from "../../hooks/useColorScheme";
import { FollowCamera } from "./FollowCamera";
import { RoutesLayer } from "./LinesLayer";
import { StationPopup } from "./StationPopup";
import { StationsLayer } from "./StationsLayer";
import { VehiclesLayer } from "./VehiclesLayer";

const INITIAL_VIEW_STATE = {
  longitude: -73.9712,
  latitude: 40.7831,
  zoom: 11,
};

export function MapEditor() {
  const { mapboxToken } = useEditorConfig();
  const { dispatch } = useMapData();
  const { pinRouteId, cancelPinMode } = usePinMode();
  const { editingLocked } = useSimMode();
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const colorScheme = useColorScheme();

  if (!mapboxToken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-100 p-8 text-center text-base text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local to load the map. See
        .env.example for details.
        {/* Embedders: pass `mapboxToken` via EditorConfigProvider instead. */}
      </div>
    );
  }

  function handleClick(event: MapMouseEvent) {
    // Clicks on an existing station are handled by that station's own Marker
    // (see StationsLayer), which stops propagation — so any click that
    // reaches here is on open map.
    setSelectedStationId(null);
    // Only place a stop when the user explicitly asked to; otherwise a click is
    // just a click, and panning or dismissing a popup no longer drops a station.
    // A running simulation is a presentation state, so editing is off while
    // the clock plays or a focused mode owns the map.
    if (!pinRouteId || editingLocked) {
      return;
    }
    dispatch({
      type: "ADD_STOP",
      lng: event.lngLat.lng,
      lat: event.lngLat.lat,
      routeId: pinRouteId,
    });
    cancelPinMode();
  }

  return (
    <Map
      id="main-map"
      mapboxAccessToken={mapboxToken}
      initialViewState={INITIAL_VIEW_STATE}
      mapStyle={
        colorScheme === "light"
          ? "mapbox://styles/mapbox/light-v11"
          : "mapbox://styles/mapbox/dark-v11"
      }
      onClick={handleClick}
      cursor={pinRouteId ? "crosshair" : "grab"}
    >
      <RoutesLayer />
      <StationsLayer onSelectStation={setSelectedStationId} />
      {/* Always mounted: the simulation is never off, only paused. */}
      <VehiclesLayer />
      <FollowCamera />
      {selectedStationId && (
        <StationPopup
          stopId={selectedStationId}
          onClose={() => setSelectedStationId(null)}
        />
      )}
      {pinRouteId && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
          <p className="pointer-events-auto flex items-center gap-3 rounded-full bg-neutral-900/90 py-2 pl-4 pr-2 text-sm text-white shadow-lg">
            Click the map to place a stop
            <button
              type="button"
              onClick={cancelPinMode}
              className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25"
            >
              Cancel (Esc)
            </button>
          </p>
        </div>
      )}
    </Map>
  );
}
