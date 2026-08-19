import { RouteSchedule, vehiclePositions } from "./simulation";

const METERS_PER_DEGREE_LAT = 111_320;

/** Ground metres per screen pixel at a Web Mercator zoom and latitude. */
function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/**
 * Shifts a lng/lat perpendicular to the segment's *draw* direction by a signed
 * pixel amount, converting pixels→metres at the current zoom so vehicles stay
 * glued to the painted (pixel-offset) track at every zoom level.
 */
function offsetPoint(
  lng: number,
  lat: number,
  drawBearingDeg: number,
  signedPx: number,
  zoom: number
): [number, number] {
  const meters = signedPx * metersPerPixel(lat, zoom);
  const phi = ((drawBearingDeg + 90) * Math.PI) / 180; // perpendicular, to the right of travel
  const dLat = (meters * Math.cos(phi)) / METERS_PER_DEGREE_LAT;
  const dLng =
    (meters * Math.sin(phi)) / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  return [lng + dLng, lat + dLat];
}

/**
 * The GeoJSON for every vehicle across all lines at simulated time `simSeconds`.
 * Vehicles ride down the centre of their line's drawn path — the only offset
 * applied is the painted per-segment one, so on a shared trunk each line's
 * vehicles still follow that line's own parallel track.
 */
export function buildVehicleFeatures(
  schedules: RouteSchedule[],
  simSeconds: number,
  zoom: number
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const schedule of schedules) {
    for (const v of vehiclePositions(schedule, simSeconds)) {
      const [lng, lat] = offsetPoint(v.lng, v.lat, v.bearing, v.offsetPx, zoom);
      features.push({
        type: "Feature",
        properties: { color: schedule.color, dwelling: v.dwelling },
        geometry: { type: "Point", coordinates: [lng, lat] },
      });
    }
  }
  return { type: "FeatureCollection", features };
}
