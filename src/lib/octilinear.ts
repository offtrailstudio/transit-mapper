/**
 * Projects lng/lat degrees to unit Web Mercator coordinates, where x and y
 * share the same scale. This matters because "45 degrees" only matches what
 * Mapbox actually renders on screen when measured in this projected space —
 * raw lng/lat degrees distort east-west vs. north-south distance away from
 * the equator.
 */
export function project(lng: number, lat: number): [number, number] {
  const x = (lng * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, y];
}

export function unproject(x: number, y: number): [number, number] {
  const lng = (x * 180) / Math.PI;
  const lat = (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);
  return [lng, lat];
}

/**
 * The bend point (in the same coordinate space as a/b) needed so both legs
 * of the path from a to b only move at 0/45/90-degree multiples, or null if
 * a straight line from a to b is already octilinear.
 */
function octilinearBendPoint(
  a: [number, number],
  b: [number, number]
): [number, number] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (adx === 0 || ady === 0 || adx === ady) {
    return null;
  }

  const diagonal = Math.min(adx, ady);
  return [a[0] + diagonal * Math.sign(dx), a[1] + diagonal * Math.sign(dy)];
}

/**
 * A straight geographic line between two stops rarely lands on a 45/90
 * degree angle, so this routes between them (in Mercator-projected space)
 * through one intermediate bend point when needed — diagonal first, then
 * axis-aligned — matching how Vignelli-style schematic transit maps route
 * between stops instead of drawing a direct diagonal line.
 */
export function octilinearPath(
  a: [number, number],
  b: [number, number]
): [number, number][] {
  const projectedA = project(a[0], a[1]);
  const projectedB = project(b[0], b[1]);
  const bend = octilinearBendPoint(projectedA, projectedB);

  if (!bend) {
    return [a, b];
  }

  return [a, unproject(bend[0], bend[1]), b];
}

/**
 * The same octilinear routing as {@link octilinearPath}, but operating
 * directly in an already-planar (Cartesian) coordinate space — no Mercator
 * projection round-trip. The schematic layout has already placed nodes on a
 * flat plane, so projecting them as if they were lng/lat would distort the
 * 45-degree bends this is meant to produce.
 */
export function octilinearPathPlane(
  a: [number, number],
  b: [number, number]
): [number, number][] {
  const bend = octilinearBendPoint(a, b);
  return bend ? [a, bend, b] : [a, b];
}
