"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-map-gl/mapbox";
import { useMapData } from "../../context/MapDataContext";
import { useSimMode } from "../../context/SimModeContext";
import { useFollowRun } from "../../hooks/useFollowRun";
import { buildRouteSchedules } from "../../lib/simulation";
import { buildFollowVehicleFeatures, buildVehicleFeatures } from "../../lib/vehicleFeatures";

const SOURCE_ID = "transit-vehicles";
const LAYER_ID = "transit-vehicles-circle";
const EMPTY: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };

/**
 * Draws the moving vehicles as one imperatively-updated GeoJSON circle layer —
 * never React markers, which would re-render hundreds of nodes per frame. A
 * single frame subscriber (from SimModeContext) recomputes positions and calls
 * `setData`, so the animation never touches React state.
 *
 * The layer is mounted for the whole session, not just while playing: the editor
 * opens on a paused simulation, so the vehicles have to be drawn (and kept true
 * to the map data as it's edited) with no frames arriving at all.
 */
export function VehiclesLayer() {
  const { current: mapRef } = useMap();
  const { state } = useMapData();
  const { subscribeFrame, publishFrame, simSecondsRef } = useSimMode();

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

  // Following swaps the whole fleet for the one vehicle being ridden, so the
  // followed line reads clearly instead of being lost among its own headway.
  // Routed through a ref for the same reason as the schedules above.
  const followRun = useFollowRun();
  const followRunRef = useRef(followRun);
  useEffect(() => {
    followRunRef.current = followRun;
  }, [followRun]);

  useEffect(() => {
    if (!mapRef) {
      return;
    }
    const map = mapRef.getMap();

    function draw(simSeconds: number) {
      const source = map.getSource(SOURCE_ID) as
        | { setData: (data: GeoJSON.FeatureCollection<GeoJSON.Point>) => void }
        | undefined;
      const follow = followRunRef.current;
      source?.setData(
        follow
          ? buildFollowVehicleFeatures(follow.schedule, follow.timeline, simSeconds, map.getZoom())
          : buildVehicleFeatures(schedulesRef.current, simSeconds, map.getZoom())
      );
    }

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
            // Small when zoomed right out, growing with zoom. The zoom curve has
            // to stay the top-level expression (Mapbox forbids nesting one), so
            // the followed vehicle's larger size rides in the stop values.
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3,
              ["case", ["get", "follow"], 4, 2],
              11,
              ["case", ["get", "follow"], 11, 7],
              16,
              ["case", ["get", "follow"], 18, 13],
            ],
            "circle-color": ["get", "color"],
            "circle-stroke-width": ["case", ["get", "follow"], 3, 1.5],
            "circle-stroke-color": "#ffffff",
            "circle-opacity": ["case", ["get", "dwelling"], 0.75, 1],
          },
        });
      }
      draw(simSecondsRef.current);
    }

    // The style may still be loading when the editor mounts.
    if (map.isStyleLoaded()) {
      addLayer();
    } else {
      map.once("styledata", addLayer);
    }

    const unsubscribe = subscribeFrame(draw);

    return () => {
      unsubscribe();
      // react-map-gl destroys the Mapbox map in its own effect cleanup, and React
      // tears a deleted subtree down parent-first — so by the time this runs on
      // unmount the map is already gone and every accessor throws ("Cannot read
      // properties of undefined (reading 'getOwnLayer')"). The layer went with the
      // map, so there is nothing to remove; only a live map needs cleaning up.
      if (map._removed) {
        return;
      }
      map.off("styledata", addLayer);
      if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
      }
      if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    };
    // Set up once per map: schedule changes flow through schedulesRef, not a re-subscribe.
  }, [mapRef, subscribeFrame, simSecondsRef]);

  // While paused there is no frame loop to pick up an edit, so a change to the
  // schedules (or to the followed run) has to repaint the fleet itself —
  // otherwise stops dragged around a paused map leave their vehicles behind.
  useEffect(() => {
    publishFrame();
  }, [schedules, followRun, publishFrame]);

  return null;
}
