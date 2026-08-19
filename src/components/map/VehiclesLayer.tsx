"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-map-gl/mapbox";
import { useMapData } from "../../context/MapDataContext";
import { useSimMode } from "../../context/SimModeContext";
import { buildRouteSchedules } from "../../lib/simulation";
import { buildVehicleFeatures } from "../../lib/vehicleFeatures";

const SOURCE_ID = "transit-vehicles";
const LAYER_ID = "transit-vehicles-circle";
const EMPTY: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };

/**
 * Draws the moving vehicles as one imperatively-updated GeoJSON circle layer —
 * never React markers, which would re-render hundreds of nodes per frame. A
 * single frame subscriber (from SimModeContext) recomputes positions and calls
 * `setData`, so the animation never touches React state.
 */
export function VehiclesLayer() {
  const { current: mapRef } = useMap();
  const { state } = useMapData();
  const { subscribeFrame } = useSimMode();

  // The frame subscriber below is registered once and reads schedules through
  // this ref. Rebuilding the schedules on every settings change (e.g. line
  // frequency) must not re-run the layer effect — tearing the source down and
  // re-subscribing mid-animation dropped edits intermittently.
  // Schedules are built from the full network (so offsets match the drawn track)
  // then filtered, so a hidden route runs no vehicles while sim mode is open.
  const schedules = useMemo(() => {
    const hiddenIds = new Set(state.data.routes.filter((route) => route.hidden).map((route) => route.id));
    return buildRouteSchedules(state.data).filter((schedule) => !hiddenIds.has(schedule.routeId));
  }, [state.data]);
  const schedulesRef = useRef(schedules);
  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

  useEffect(() => {
    if (!mapRef) {
      return;
    }
    const map = mapRef.getMap();

    function addLayer() {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY });
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          paint: {
            // Small when zoomed right out, growing with zoom.
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2, 11, 7, 16, 13],
            "circle-color": ["get", "color"],
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": ["case", ["get", "dwelling"], 0.75, 1],
          },
        });
      }
    }

    // The style may still be loading when sim mode opens.
    if (map.isStyleLoaded()) {
      addLayer();
    } else {
      map.once("styledata", addLayer);
    }

    const unsubscribe = subscribeFrame((simSeconds) => {
      const source = map.getSource(SOURCE_ID) as
        | { setData: (data: GeoJSON.FeatureCollection<GeoJSON.Point>) => void }
        | undefined;
      source?.setData(buildVehicleFeatures(schedulesRef.current, simSeconds, map.getZoom()));
    });

    return () => {
      unsubscribe();
      map.off("styledata", addLayer);
      if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
      }
      if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    };
    // Set up once per map: schedule changes flow through schedulesRef, not a re-subscribe.
  }, [mapRef, subscribeFrame]);

  return null;
}
