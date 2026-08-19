"use client";

import { Layer, Source } from "react-map-gl/mapbox";
import { useMapData } from "../../context/MapDataContext";
import { buildRouteRuns, LINE_WIDTH_PX } from "../../lib/lineGeometry";

const SOURCE_ID = "transit-lines";

export function RoutesLayer() {
  const { state } = useMapData();
  // Build runs from the full network so shared-trunk offsets stay put, then drop
  // the hidden routes at the render layer — hiding a route mustn't shift its
  // parallel neighbours sideways.
  const hiddenIds = new Set(state.data.routes.filter((route) => route.hidden).map((route) => route.id));
  const runs = buildRouteRuns(state.data).filter((run) => !hiddenIds.has(run.routeId));

  const geojson: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
    type: "FeatureCollection",
    features: runs.map((run) => ({
      type: "Feature",
      properties: { color: run.color, offsetPixels: run.offsetPixels },
      geometry: { type: "LineString", coordinates: run.coordinates },
    })),
  };

  return (
    <Source id={SOURCE_ID} type="geojson" data={geojson}>
      <Layer
        id="transit-lines-line"
        type="line"
        source={SOURCE_ID}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": ["get", "color"],
          "line-width": LINE_WIDTH_PX,
          "line-offset": ["get", "offsetPixels"],
        }}
      />
    </Source>
  );
}
