"use client";

import { Marker } from "react-map-gl/mapbox";
import { useMapData } from "../../context/MapDataContext";
import { useSimMode } from "../../context/SimModeContext";
import { getVisibleStops } from "../../lib/selectors";

export function StationsLayer({ onSelectStation }: { onSelectStation: (stopId: string) => void }) {
  const { state, dispatch, readOnly } = useMapData();
  const { editingLocked } = useSimMode();
  const draggable = !editingLocked && !readOnly;
  const stops = getVisibleStops(state.data);

  return (
    <>
      {stops.map((stop) => (
        <Marker
          key={stop.id}
          longitude={stop.lng}
          latitude={stop.lat}
          draggable={draggable}
          onDragEnd={(e) =>
            dispatch({ type: "MOVE_STOP", stopId: stop.id, lng: e.lngLat.lng, lat: e.lngLat.lat })
          }
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onSelectStation(stop.id);
          }}
        >
          <div
            className={`h-3 w-3 rounded-full border-[3px] border-neutral-900 bg-white dark:border-neutral-100 ${
              draggable ? "cursor-grab active:cursor-grabbing" : ""
            }`}
          />
        </Marker>
      ))}
    </>
  );
}
