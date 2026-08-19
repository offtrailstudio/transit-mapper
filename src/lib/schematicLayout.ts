import { primaryStopIds } from "./lines";
import { clusterStations } from "./stationClusters";
import { project } from "./octilinear";
import { TransitMapData } from "./types";

// Target length for every edge, in abstract plane units. The whole layout is
// rescaled to the print sheet afterwards, so the absolute value only matters
// relative to MIN_SEPARATION.
const UNIT = 1;
// Non-adjacent nodes are pushed apart until at least this far — a little under
// UNIT so a normal one-stop gap survives but genuine pile-ups spread out.
const MIN_SEPARATION = 0.85 * UNIT;
const ITERATIONS = 400;
// Per-iteration pull toward the octilinear/unit-length ideal, and push out of
// collisions. Kept well under 1 so opposing forces average out instead of
// oscillating.
const EDGE_FORCE = 0.35;
const SEPARATION_FORCE = 0.5;
const OCTILINEAR_STEP = Math.PI / 4;

type Vec = [number, number];

/** The unit-length vector whose angle is the nearest multiple of 45°. */
function snapDirection(dx: number, dy: number): Vec {
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / OCTILINEAR_STEP) * OCTILINEAR_STEP;
  return [Math.cos(snapped) * UNIT, Math.sin(snapped) * UNIT];
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/**
 * Places each station on an abstract plane as a schematic (Vignelli/Beck-style)
 * diagram rather than a geographic map. It is a heuristic, not an optimal
 * solver: nodes are seeded from their real projected positions (so the diagram
 * keeps the map's rough orientation), then relaxed so that
 *
 *  - every edge is pulled toward a uniform length and the nearest 45° angle —
 *    the even spacing is what stops a downtown cluster of 20 stops from piling
 *    up, and the angle snap gives the clean octilinear look; and
 *  - nodes that drift too close are pushed apart, opening room for labels.
 *
 * Stations that cluster to the same real-world node (see clusterStations) share
 * one position, so a stop on three routes is laid out once. Returns a position
 * for every original stop id. Fully deterministic — no randomness — so the
 * same map always exports the same diagram.
 */
export function computeSchematicPositions(data: TransitMapData): Map<string, [number, number]> {
  const result = new Map<string, [number, number]>();
  if (data.stops.length === 0) return result;

  const clusterOf = clusterStations(data.stops);

  // One node per cluster, seeded from the mean of its members' projected
  // coordinates so the diagram starts out oriented like the real map.
  const sums = new Map<string, { x: number; y: number; n: number }>();
  for (const stop of data.stops) {
    const rep = clusterOf.get(stop.id) ?? stop.id;
    const [px, py] = project(stop.lng, stop.lat);
    const acc = sums.get(rep) ?? { x: 0, y: 0, n: 0 };
    acc.x += px;
    acc.y += py;
    acc.n += 1;
    sums.set(rep, acc);
  }

  const nodeIds = [...sums.keys()];
  const index = new Map(nodeIds.map((id, i) => [id, i]));
  const pos: Vec[] = nodeIds.map((id) => {
    const acc = sums.get(id)!;
    return [acc.x / acc.n, acc.y / acc.n];
  });

  // Distinct undirected edges between clusters, so a shared trunk is not
  // weighted more heavily than a branch.
  const edgeSet = new Map<string, [number, number]>();
  for (const route of data.routes) {
    const stopIds = primaryStopIds(route);
    for (let i = 0; i < stopIds.length - 1; i++) {
      const a = clusterOf.get(stopIds[i]) ?? stopIds[i];
      const b = clusterOf.get(stopIds[i + 1]) ?? stopIds[i + 1];
      if (a === b) continue;
      const ia = index.get(a);
      const ib = index.get(b);
      if (ia === undefined || ib === undefined) continue;
      edgeSet.set(edgeKey(a, b), [ia, ib]);
    }
  }
  const edges = [...edgeSet.values()];

  const write = () => {
    for (const stop of data.stops) {
      const rep = clusterOf.get(stop.id) ?? stop.id;
      const [x, y] = pos[index.get(rep)!];
      result.set(stop.id, [x, y]);
    }
  };

  // With no edges there is nothing to schematize; hand back the seeded
  // positions (the export's own fit-scale takes care of sizing them).
  if (edges.length === 0) {
    write();
    return result;
  }

  // Rescale the seed so its average edge already sits near UNIT — otherwise
  // the tiny Mercator-radian spacing all falls inside MIN_SEPARATION and the
  // separation force would scatter the seed before edges can orient it.
  const seedAvg =
    edges.reduce((sum, [ia, ib]) => sum + Math.hypot(pos[ia][0] - pos[ib][0], pos[ia][1] - pos[ib][1]), 0) /
    edges.length;
  if (seedAvg > 0) {
    const k = UNIT / seedAvg;
    for (const p of pos) {
      p[0] *= k;
      p[1] *= k;
    }
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const disp: Vec[] = pos.map(() => [0, 0]);

    for (const [ia, ib] of edges) {
      const dx = pos[ib][0] - pos[ia][0];
      const dy = pos[ib][1] - pos[ia][1];
      const [tx, ty] = snapDirection(dx, dy);
      // Move both endpoints halfway toward the ideal vector, preserving the
      // edge's midpoint so the layout as a whole barely drifts.
      const ex = ((tx - dx) / 2) * EDGE_FORCE;
      const ey = ((ty - dy) / 2) * EDGE_FORCE;
      disp[ia][0] -= ex;
      disp[ia][1] -= ey;
      disp[ib][0] += ex;
      disp[ib][1] += ey;
    }

    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        let dx = pos[j][0] - pos[i][0];
        let dy = pos[j][1] - pos[i][1];
        let dist = Math.hypot(dx, dy);
        if (dist >= MIN_SEPARATION) continue;
        if (dist === 0) {
          // Deterministic tie-break so coincident nodes separate the same way
          // every run (no Math.random, which also keeps exports reproducible).
          const angle = i * 2.399963229728653; // golden angle
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const push = ((MIN_SEPARATION - dist) / 2) * SEPARATION_FORCE;
        const ux = dx / dist;
        const uy = dy / dist;
        disp[i][0] -= ux * push;
        disp[i][1] -= uy * push;
        disp[j][0] += ux * push;
        disp[j][1] += uy * push;
      }
    }

    for (let i = 0; i < pos.length; i++) {
      pos[i][0] += disp[i][0];
      pos[i][1] += disp[i][1];
    }
  }

  write();
  return result;
}
