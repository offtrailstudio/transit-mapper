"use client";

import { useState } from "react";
import { useMap } from "react-map-gl/mapbox";
import { MapPin, Search, ListPlus } from "lucide-react";
import { Modal } from "../Modal";
import { useMapData } from "../../context/MapDataContext";
import { usePinMode } from "../../context/PinModeContext";
import { primaryStopIds } from "../../lib/lines";
import { Route } from "../../lib/types";
import { StationSearch, type Suggestion } from "./StationSearch";

type Mode = "search" | "existing" | "pin";

const MODES: { id: Mode; label: string; icon: typeof Search }[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "existing", label: "Existing", icon: ListPlus },
  { id: "pin", label: "Place pin", icon: MapPin },
];

const SEARCH_RESULT_ZOOM = 15;

export function AddStopModal({
  route,
  open,
  onClose,
}: {
  route: Route;
  open: boolean;
  onClose: () => void;
}) {
  const { state, dispatch } = useMapData();
  const { startPinMode } = usePinMode();
  const { "main-map": map } = useMap();
  const [mode, setMode] = useState<Mode>("search");

  const routeStops = primaryStopIds(route);
  const availableStops = state.data.stops.filter((p) => !routeStops.includes(p.id));

  function addFromSearch(suggestion: Suggestion) {
    dispatch({
      type: "ADD_STOP",
      lng: suggestion.lng,
      lat: suggestion.lat,
      name: suggestion.name,
      routeId: route.id,
    });
    map?.flyTo({ center: [suggestion.lng, suggestion.lat], zoom: SEARCH_RESULT_ZOOM });
    onClose();
  }

  function addExisting(stopId: string) {
    dispatch({ type: "ADD_STOP_TO_ROUTE", routeId: route.id, stopId });
    onClose();
  }

  // The modal has to get out of the way before the map becomes clickable.
  function beginPinMode() {
    startPinMode(route.id);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Add a stop to ${route.name}`}>
      <div className="mb-3 flex gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium ${
              mode === id
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {mode === "search" && <StationSearch onSelect={addFromSearch} autoFocus />}

      {mode === "existing" &&
        (availableStops.length === 0 ? (
          <p className="py-2 text-sm text-neutral-500">
            Every station on this map is already a stop on {route.name}.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {availableStops.map((stop) => (
              <li key={stop.id}>
                <button
                  type="button"
                  onClick={() => addExisting(stop.id)}
                  className="w-full truncate rounded-md border border-neutral-300 px-3 py-2 text-left text-base hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {stop.name}
                </button>
              </li>
            ))}
          </ul>
        ))}

      {mode === "pin" && (
        <div>
          <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
            Closes this dialog and lets you click once on the map to drop a stop. Outside this
            mode, clicking the map does nothing.
          </p>
          <button
            type="button"
            onClick={beginPinMode}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            <MapPin size={16} />
            Place a pin on the map
          </button>
        </div>
      )}
    </Modal>
  );
}
