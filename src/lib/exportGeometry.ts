import { offsetPolyline } from "./offsetPolyline";
import { buildRouteRuns, EdgeRouter, LINE_WIDTH_PX, OFFSET_STEP_PX } from "./lineGeometry";
import { primaryStopIds } from "./lines";
import { octilinearPathPlane, project, unproject } from "./octilinear";
import { computeSchematicPositions } from "./schematicLayout";
import { defaultTextMeasurer, type TextMeasurer, type TextStyle } from "./textMeasure";
import { LabelOverride, Stop, TransitMapData } from "./types";

// Geographic: the map printed as-is, projected from real coordinates.
// Schematic: redrawn as a Vignelli/Beck-style diagram (uniform spacing, clean
// octilinear angles) so dense networks stay legible. See computeSchematicPositions.
export type LayoutMode = "geographic" | "schematic";

export type PrintSizeId = "12x16" | "18x24" | "24x36";

export type PrintSize = { id: PrintSizeId; label: string; widthIn: number; heightIn: number };

export const PRINT_SIZES: PrintSize[] = [
  { id: "12x16", label: "12 × 16 in", widthIn: 12, heightIn: 16 },
  { id: "18x24", label: "18 × 24 in", widthIn: 18, heightIn: 24 },
  { id: "24x36", label: "24 × 36 in", widthIn: 24, heightIn: 36 },
];

export const DEFAULT_PRINT_SIZE_ID: PrintSizeId = "18x24";
export const EXPORT_DPI = 300;
// A poster-weight line: at 300 DPI this is ~0.16 in wide, close to how a
// Vignelli/TfL sheet reads. The old 16px hairline vanished on the sheet.
export const EXPORT_LINE_WIDTH_PX = 48;
// Interchange-style markers: a filled dot with a heavy ring, sized off the
// line width so dots and lines scale together at every print size.
export const STATION_RADIUS_PX = Math.round(EXPORT_LINE_WIDTH_PX * 0.62);
export const STATION_STROKE_WIDTH_PX = Math.round(EXPORT_LINE_WIDTH_PX * 0.34);
// Shared with exportSvg.ts (which draws the label text) — needed here too,
// to reserve enough room for it so long station names don't run off the edge
// and to size the collision boxes the placement pass tests against.
export const LABEL_FONT_SIZE_PX = 88;

// Legend — one row per distinct line (color swatch + name), stacked inside a
// bordered rounded card (Vignelli map guide). Sized so the stack reads as a
// caption band, not fine print. Shared with exportSvg.ts.
export const LEGEND_FONT_SIZE_PX = 84;
export const LEGEND_ROW_HEIGHT_PX = 150;
export const LEGEND_SWATCH_LEN_PX = 170;
export const LEGEND_SWATCH_GAP_PX = 48;
// The card wrapping the legend: interior padding, a heading, and the gap below
// it before the first swatch row. Sized to read as a map-guide card.
export const LEGEND_CARD_PADDING_PX = 80;
export const LEGEND_HEADING_FONT_SIZE_PX = 100;
export const LEGEND_HEADING_GAP_PX = 64;
export const LEGEND_HEADING_TEXT = "Lines";
// The styles the legend's two kinds of text are drawn in, so the card is sized
// from the same metrics exportSvg.ts renders with rather than a guess.
const LEGEND_LABEL_STYLE = { fontSizePx: LEGEND_FONT_SIZE_PX, fontWeight: 600 };
const LEGEND_HEADING_STYLE = {
  fontSizePx: LEGEND_HEADING_FONT_SIZE_PX,
  fontWeight: 700,
  letterSpacingPx: 2,
};

const MARGIN_IN = 1;
// Uniform padding between the sheet edge and any content (title, footer,
// legend, and the nearest station label) on all four sides. Exported so
// exportSvg.ts places the title/footer at the same inset. Removing the old
// keyline frame, this is the only thing framing the poster.
export const EXPORT_MARGIN_PX = MARGIN_IN * EXPORT_DPI;
// Match the live map's ratio of parallel-line gap to line width, rather than
// picking an export offset independently — an independently-tuned value is
// exactly how the earlier real-world-meters offset went invisible: it read
// fine at the scale it was tuned for and wrong everywhere else.
const EXPORT_OFFSET_STEP_PX = Math.round(OFFSET_STEP_PX * (EXPORT_LINE_WIDTH_PX / LINE_WIDTH_PX));
// A label clears its dot by the marker's full extent plus a gap, so text
// never kisses the ring.
const LABEL_GAP_PX = 40;
const LABEL_OFFSET_X_PX = STATION_RADIUS_PX + STATION_STROKE_WIDTH_PX + LABEL_GAP_PX;
const LABEL_OFFSET_Y_PX = STATION_RADIUS_PX + STATION_STROKE_WIDTH_PX;
// Reserved space, inside the uniform margin, for the title (only when one is
// set) and the always-shown domain footer — the title/footer text plus a
// generous gap down to the map so it doesn't crowd the artwork.
const TITLE_AREA_PX = 780;
const FOOTER_AREA_PX = 160;
// A nominal character advance, used only to size the fixed edge reservation
// below. Collision boxes never go through it — those are measured (see
// textMeasure.ts) — but the reservation is decided before any name is known.
const AVG_LABEL_CHAR_WIDTH_RATIO = 0.58;
// A label can fall on either side of its dot, so reserve room on both edges —
// but only a moderate, fixed allowance rather than the full longest name. The
// placement pass already flips a label to whichever side has room and prefers
// staying inside the frame, so an edge station's name turns inward instead of
// demanding a reservation the width of the map's longest name (which used to
// shrink the drawing to a fraction of the sheet).
function labelSideAllowance(fontSizePx: number): number {
  return fontSizePx * AVG_LABEL_CHAR_WIDTH_RATIO * 8;
}
/**
 * Everything about a label that scales with its type size. The size is a print
 * setting now (the panel can dial it up or down), so these can no longer be
 * module constants — they are derived once per layout and passed down, and
 * `ExportLayout` carries the size so exportSvg.ts draws at exactly what was
 * measured against.
 */
export type LabelMetrics = {
  fontSizePx: number;
  /** The text style to measure with, matching the `<text>` exportSvg.ts emits. */
  style: TextStyle;
  /** The air two neighbouring labels need between them to read as two labels. */
  padding: number;
  /** Offset from the dot to a label directly above or below it: the whole line
   *  of text has to clear the ring, so it carries half the text height on top of
   *  the gap the diagonals use. */
  offsetAbove: number;
  /** Offset from the dot to a schematic label's anchor, before the ring multiplier. */
  angledOffset: number;
  /**
   * The single ring every label's anchor sits on. Radial text runs edge-on to
   * the stop, so one radius clears the marker in all eight directions — which is
   * what lets an automatic placement and a hand-made one be the same thing.
   */
  radius: number;
};

export function labelMetrics(fontSizePx: number): LabelMetrics {
  return {
    fontSizePx,
    style: { fontSizePx, fontWeight: 600 },
    padding: Math.round(fontSizePx * 0.22),
    offsetAbove: LABEL_OFFSET_X_PX + fontSizePx / 2,
    angledOffset: LABEL_OFFSET_X_PX + fontSizePx / 2,
    radius: LABEL_OFFSET_X_PX + fontSizePx * 0.1,
  };
}

// Room below the bottom-most dot for its label, plus breathing space between
// the map and the legend/footer band so the two don't crowd each other.
const LABEL_BOTTOM_ALLOWANCE_PX = 460;

export type LegendEntry = { name: string; color: string; x: number; y: number };

// The bordered rounded card the legend rows sit inside. Its own box so the SVG
// builder can draw the border/heading without re-deriving the layout.
export type LegendCard = {
  x: number;
  y: number;
  width: number;
  height: number;
  heading: string;
  headingX: number;
  headingY: number;
};

export type ExportStation = {
  id: string;
  name: string;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  // Optional so the SVG builder's own tests can construct bare stations;
  // computeExportLayout always sets it (see placeLabels). "middle" goes with the
  // directly-above/below slots, where the name straddles the dot.
  textAnchor?: TextAnchor;
  // Degrees to rotate the label about (labelX, labelY). Schematic mode angles
  // labels at -45° (the Vignelli up-to-the-right diagonal); geographic leaves
  // this undefined (horizontal).
  rotate?: number;
  /**
   * The name is deliberately not printed for this stop. The dot still is —
   * hiding a label must never hide the station, only its text — and it draws
   * smaller, the way a minor halt reads against an interchange on a real sheet.
   */
  labelHidden?: boolean;
  /**
   * The bearing the label ended up on, whether chosen by the placer or set by
   * hand. Lets the rotate control start from where the label actually is
   * instead of teleporting it to an arbitrary default on the first click.
   */
  labelAngle?: number;
};

export type ExportLayout = {
  widthPx: number;
  heightPx: number;
  title: string;
  /**
   * The type size the labels were laid out against. Carried on the layout (not
   * read as a constant) so exportSvg.ts draws them at exactly the size the
   * collision boxes were measured at — the two drifting apart is precisely how
   * a "bigger labels" setting would silently reintroduce overlap.
   */
  labelFontSizePx: number;
  lines: { routeId: string; color: string; points: [number, number][] }[];
  stations: ExportStation[];
  // Optional for the same reason as textAnchor; always populated in practice.
  legend?: LegendEntry[];
  // The card framing the legend; present whenever there are legend rows.
  legendCard?: LegendCard;
  // The lng/lat bounds the full sheet covers, so a geographic basemap raster can
  // be requested for exactly this window and dropped in pixel-aligned. Only set
  // in geographic mode — schematic distorts geography, so no real map fits it.
  geoBounds?: GeoBounds;
};

export type GeoBounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export type TextAnchor = "start" | "middle" | "end";

type Box = { minX: number; maxX: number; minY: number; maxY: number };
type Segment = { ax: number; ay: number; bx: number; by: number };

/**
 * Everything already on the sheet that a label should stay off: the station
 * dots, the drawn route centrelines, and the legend card. Lines are kept as
 * segments rather than boxes — a 45° run's bounding box is a huge square that
 * would veto placements nowhere near the track.
 */
type LabelObstacles = { dots: Box[]; segments: Segment[]; cards: Box[] };

/** The region a label has to stay inside: the sheet less its margins and reserved bands. */
type Frame = { minX: number; maxX: number; minY: number; maxY: number };

function boundingBox(points: [number, number][]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function fitScale(bboxWidth: number, bboxHeight: number, availableWidth: number, availableHeight: number) {
  if (bboxWidth <= 0 && bboxHeight <= 0) {
    return 1;
  }
  const widthScale = bboxWidth > 0 ? availableWidth / bboxWidth : Infinity;
  const heightScale = bboxHeight > 0 ? availableHeight / bboxHeight : Infinity;
  return Math.min(widthScale, heightScale);
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function inflate(box: Box, by: number): Box {
  return { minX: box.minX - by, maxX: box.maxX + by, minY: box.minY - by, maxY: box.maxY + by };
}

/**
 * Liang–Barsky: does the segment touch the box at all? Used to ask whether a
 * label sits on a route, which is the collision the placer used to be blind to
 * (it only ever tested dots and other labels, so names printed over track).
 */
export function segmentIntersectsBox(segment: Segment, box: Box): boolean {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  // Degenerate segment: it's a point, so a plain containment test.
  if (dx === 0 && dy === 0) {
    return (
      segment.ax >= box.minX && segment.ax <= box.maxX && segment.ay >= box.minY && segment.ay <= box.maxY
    );
  }

  let enter = 0;
  let exit = 1;
  const clips: [number, number][] = [
    [-dx, segment.ax - box.minX],
    [dx, box.maxX - segment.ax],
    [-dy, segment.ay - box.minY],
    [dy, box.maxY - segment.ay],
  ];

  for (const [p, q] of clips) {
    if (p === 0) {
      // Parallel to this edge: outside it means no crossing is possible at all.
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > exit) return false;
      if (t > enter) enter = t;
    } else {
      if (t < enter) return false;
      if (t < exit) exit = t;
    }
  }
  return true;
}

/** Half the drawn stroke, so "touches the line" means the ink, not the centreline. */
const LINE_HALF_WIDTH_PX = EXPORT_LINE_WIDTH_PX / 2;

function hitsAnyLine(box: Box, segments: Segment[]): boolean {
  const padded = inflate(box, LINE_HALF_WIDTH_PX);
  return segments.some((segment) => segmentIntersectsBox(segment, padded));
}

type LabelDirection = { dx: number; dy: number; anchor: TextAnchor };

// Axis-aligned bounds of a label rectangle after rotating it by `angle`
// degrees about its anchor (labelX, labelY). At angle 0 this is exactly the
// old horizontal box, so the geographic layout is unchanged; the rotation is
// the same one SVG applies via rotate(angle, labelX, labelY).
function labelBox(
  labelX: number,
  labelY: number,
  width: number,
  anchor: TextAnchor,
  angle: number,
  h: number
): Box {
  const x0 = anchor === "end" ? -width : anchor === "middle" ? -width / 2 : 0;
  const corners: [number, number][] = [
    [x0, -h / 2],
    [x0 + width, -h / 2],
    [x0 + width, h / 2],
    [x0, h / 2],
  ];
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [lx, ly] of corners) {
    xs.push(labelX + lx * cos - ly * sin);
    ys.push(labelY + lx * sin + ly * cos);
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// Geographic: horizontal text at eight compass slots. The four diagonals come
// first and in their historical order (down-right first), so an unobstructed
// station lands exactly where it always did and existing maps barely move; the
// level and above/below slots are escape valves the placer only reaches for
// when the diagonals are blocked — most often by the station's own route, which
// runs straight through two of them.
/**
 * Puts a label at an explicit bearing around its stop, reading radially outward.
 *
 * `angleDeg` is a compass bearing: 0 is straight up, 90 due right, clockwise.
 * The text's baseline lies along the ray out of the stop, so its rotation is
 * `bearing - 90` — a label due right reads horizontally (0°), one straight up
 * reads vertically, one to the south-east sits at 45°.
 *
 * The half of the dial that would leave text upside-down is turned a further
 * 180° and anchored at its end instead, which keeps every name reading
 * left-to-right while still running away from the stop.
 */
export function placeAtAngle(
  station: { x: number; y: number },
  width: number,
  angleDeg: number,
  metrics: LabelMetrics,
  ring = 1
): { labelX: number; labelY: number; anchor: TextAnchor; rotate: number; box: Box } {
  const bearing = ((angleDeg % 360) + 360) % 360;
  const radians = (bearing * Math.PI) / 180;
  // Canvas y grows downward, so north is -y.
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);

  // The anchor sits clear of the ring; the text then runs outward from there, so
  // no extra allowance for the line's height is needed at any bearing.
  const reach = metrics.radius * ring;
  const labelX = station.x + dx * reach;
  const labelY = station.y + dy * reach;

  const upright = ((bearing - 90) % 360 + 360) % 360;
  const upsideDown = upright > 90 && upright < 270;
  const rotate = upsideDown ? (upright + 180) % 360 : upright;
  const anchor: TextAnchor = upsideDown ? "end" : "start";

  return {
    labelX,
    labelY,
    anchor,
    rotate,
    box: labelBox(labelX, labelY, width, anchor, rotate, metrics.fontSizePx),
  };
}

/**
 * The eight bearings a label may take, best-reading first: the two flat sides,
 * then the diagonals, then the two that read vertically. Every label — automatic
 * or hand-placed — lands on one of these, which is what makes the rotate control
 * step through the same set the placer chose from.
 */
export const LABEL_BEARINGS = [90, 270, 135, 45, 225, 315, 180, 0] as const;

// One ring, so every label — automatic or hand-placed — sits at a position the
// rotate control can actually reach. A second, wider ring used to be tried as an
// escape for crowded stops and did clear more routes, but it put labels at a
// distance no override could reproduce, so the first rotate click would yank
// them inwards. Consistency won; the few that land on a route are the user's to
// nudge or hide, which is what the per-stop controls are for.
const LABEL_RINGS = [1];

// Placement costs. A label landing on another label is the worst thing on the
// sheet and outranks every preference; running off the sheet is worse still.
// Crossing a route costs more than a couple of steps down the direction order,
// so the placer will happily take a less canonical slot to keep text off track,
// and more than a ring, so it will push a label outward for the same reason.
const COST_OFF_FRAME = 100;
const COST_LABEL_OVERLAP = 20;
const COST_CARD_OVERLAP = 16;
const COST_DOT_OVERLAP = 12;
const COST_LINE_CROSS = 6;
const COST_PER_RING = 1.5;
const COST_PER_RANK = 0.4;

// Schematic scores a whole run at once, so its obstacle cost is a per-stop mean
// while these preference terms are flat. They have to stay well under what one
// stop clearing a route is worth once spread across a run (COST_LINE_CROSS / n),
// or a five-stop comb will never step outward to fix the one label sitting on a
// crossing line — which is exactly what the geographic constants did here.
const SCHEMATIC_ANGLE_PENALTY = 0.8;
const SCHEMATIC_SIDE_PENALTY = 0.2;
const SCHEMATIC_RING_PENALTY = 0.3;


/**
 * What it costs to put `box` here. Summed rather than tested as a boolean: the
 * old placer took the first slot that was clear and, when none was, fell back
 * to the first that merely fit — so a station with no perfect slot got an
 * arbitrary one instead of its least-bad one, and that bad box then pushed its
 * neighbours around too.
 */
function placementCost(
  box: Box,
  frame: Frame,
  obstacles: LabelObstacles,
  placedLabels: Box[],
  padding: number
): number {
  let cost = 0;
  if (box.minX < frame.minX || box.maxX > frame.maxX || box.minY < frame.minY || box.maxY > frame.maxY) {
    cost += COST_OFF_FRAME;
  }
  // Only label-against-label is measured with the gap. Two names whose boxes
  // merely fail to touch still print as one crowded block, so they need real
  // air between them — whereas a label needs no extra clearance from a route
  // (its halo already separates it) or from the margin, and demanding it there
  // just costs placements that were fine.
  const spaced = inflate(box, padding);
  for (const other of placedLabels) {
    if (boxesOverlap(spaced, other)) cost += COST_LABEL_OVERLAP;
  }
  for (const dot of obstacles.dots) {
    if (boxesOverlap(box, dot)) cost += COST_DOT_OVERLAP;
  }
  for (const card of obstacles.cards) {
    if (boxesOverlap(box, card)) cost += COST_CARD_OVERLAP;
  }
  if (hitsAnyLine(box, obstacles.segments)) cost += COST_LINE_CROSS;
  return cost;
}

/**
 * How many routes call at each stop. Interchanges and busy stops are labelled
 * first so they get the pick of the slots — under the old `data.stops` ordering
 * a one-platform halt could take the good position and leave the interchange
 * beside it printing over a line.
 */
function labelPriority(routes: TransitMapData["routes"]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const route of routes) {
    for (const id of new Set(primaryStopIds(route))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}


/**
 * Geographic label placement: horizontal text dropped into whichever of eight
 * compass slots (at either of two distances) costs least, given the dots, the
 * routes, the legend card, and every label already placed. Busiest stops are
 * placed first so they get first pick; the result comes back in the caller's
 * order regardless.
 */
function placeLabels(
  stations: { id: string; name: string; x: number; y: number }[],
  frame: Frame,
  obstacles: LabelObstacles,
  routes: TransitMapData["routes"],
  measure: TextMeasurer,
  metrics: LabelMetrics,
  overrides: Record<string, LabelOverride>
): ExportStation[] {
  const placedLabels: Box[] = [];
  const result = new Map<string, ExportStation>();
  const priority = labelPriority(routes);
  // Ties break on the caller's order, so the same map always lays out the same way.
  const order = stations
    .map((station, index) => ({ station, index }))
    .sort((a, b) => (priority.get(b.station.id) ?? 0) - (priority.get(a.station.id) ?? 0) || a.index - b.index);

  for (const { station } of order) {
    const override = overrides[station.id];
    // A hidden label occupies nothing, which is the point: turning one off
    // hands its room to its neighbours instead of merely blanking the text.
    if (override?.hidden) {
      result.set(station.id, {
        id: station.id,
        name: station.name,
        x: station.x,
        y: station.y,
        labelX: station.x,
        labelY: station.y,
        labelHidden: true,
      });
      continue;
    }

    const width = measure(station.name, metrics.style);
    let best:
      | { labelX: number; labelY: number; box: Box; anchor: TextAnchor; rotate: number; bearing: number; cost: number }
      | null = null;

    if (override?.angle !== undefined) {
      // Placed exactly where it was asked for, cost be damned — an override that
      // the placer could overrule wouldn't be an override. Its box still joins
      // the obstacle set, so the automatic labels route around it.
      const placed = placeAtAngle(station, width, override.angle, metrics);
      placedLabels.push(placed.box);
      result.set(station.id, {
        id: station.id,
        name: station.name,
        x: station.x,
        y: station.y,
        labelX: placed.labelX,
        labelY: placed.labelY,
        textAnchor: placed.anchor,
        labelAngle: override.angle,
        ...(placed.rotate !== 0 ? { rotate: placed.rotate } : {}),
      });
      continue;
    }

    LABEL_BEARINGS.forEach((bearing, rank) => {
      LABEL_RINGS.forEach((ring, ringIndex) => {
        const placed = placeAtAngle(station, width, bearing, metrics, ring);
        const cost =
          placementCost(placed.box, frame, obstacles, placedLabels, metrics.padding) +
          rank * COST_PER_RANK +
          ringIndex * COST_PER_RING;
        if (!best || cost < best.cost) {
          best = { ...placed, bearing, cost };
        }
      });
    });

    const chosen = best!;
    // Recorded even when it collided: the label really is there, and the next
    // station should route around it rather than pile on.
    placedLabels.push(chosen.box);
    result.set(station.id, {
      id: station.id,
      name: station.name,
      x: station.x,
      y: station.y,
      labelX: chosen.labelX,
      labelY: chosen.labelY,
      textAnchor: chosen.anchor,
      labelAngle: chosen.bearing,
      ...(chosen.rotate !== 0 ? { rotate: chosen.rotate } : {}),
    });
  }

  return stations.map((station) => result.get(station.id)!);
}

// Undirected orientation (degrees, [0, 180)) of the segment a→b in canvas space.
function orientation(a: [number, number], b: [number, number]): number {
  const deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return ((deg % 180) + 180) % 180;
}

// Snap an undirected orientation to the nearest octilinear axis: 0, 45, 90, 135.
function snapAxis(deg: number): number {
  return (Math.round(deg / 45) * 45) % 180;
}

type LabelRun = { ids: string[]; axis: number };

/**
 * Splits every line into maximal straight runs — consecutive stops whose edges
 * share one octilinear axis. Labels are then decided per run (not per stop), so
 * a trunk's names don't zig-zag from side to side. A corner stop belongs to the
 * run ending at it; the next run starts there too, but whichever run is placed
 * first claims the label.
 */
function buildLabelRuns(routes: TransitMapData["routes"], posById: Map<string, [number, number]>): LabelRun[] {
  const runs: LabelRun[] = [];
  for (const route of routes) {
    const stops = primaryStopIds(route).filter((id) => posById.has(id));
    if (stops.length === 0) continue;
    if (stops.length === 1) {
      runs.push({ ids: [stops[0]], axis: 90 });
      continue;
    }
    let start = 0;
    let axis = snapAxis(orientation(posById.get(stops[0])!, posById.get(stops[1])!));
    for (let i = 1; i < stops.length - 1; i++) {
      const next = snapAxis(orientation(posById.get(stops[i])!, posById.get(stops[i + 1])!));
      if (next !== axis) {
        runs.push({ ids: stops.slice(start, i + 1), axis });
        start = i;
        axis = next;
      }
    }
    runs.push({ ids: stops.slice(start), axis });
  }
  return runs;
}

// The label orientations (screen degrees) that read well against a run on the
// given axis, best first. A vertical trunk takes horizontal labels down one
// side; a horizontal trunk must angle its labels (horizontal ones would collide
// along the row); a diagonal trunk reads best horizontal, vertical as fallback.
function axisLabelAngles(axis: number): number[] {
  if (axis === 0) return [-45, 45];
  if (axis === 90) return [0];
  return [0, -90];
}

// Where a single station's label sits for a chosen run axis, label angle, and
// side. The label is offset perpendicular to the run and anchored so its text
// runs outward, away from the track.
function schematicPlacement(
  x: number,
  y: number,
  width: number,
  axis: number,
  angle: number,
  side: 1 | -1,
  ring: number,
  metrics: LabelMetrics
): { labelX: number; labelY: number; anchor: TextAnchor; box: Box } {
  const perp = ((axis + 90) * Math.PI) / 180;
  const nx = Math.cos(perp) * side;
  const ny = Math.sin(perp) * side;
  const off = metrics.radius * ring;
  const labelX = x + nx * off;
  const labelY = y + ny * off;
  const rad = (angle * Math.PI) / 180;
  const anchor: TextAnchor = Math.cos(rad) * nx + Math.sin(rad) * ny >= 0 ? "start" : "end";
  return { labelX, labelY, anchor, box: labelBox(labelX, labelY, width, anchor, angle, metrics.fontSizePx) };
}

/**
 * Schematic label placement. Decides each straight run's labels together — one
 * angle and one side for the whole run — so a trunk reads as a tidy parallel
 * comb instead of names jumping between sides and tilts. Longer runs are placed
 * first (they set the dominant combs); a shared stop is claimed by the first run
 * to place it. For each run it scores every (angle, side) option across all the
 * run's stops and takes the one with the least off-sheet/collision cost.
 */
function placeSchematicLabels(
  stations: { id: string; name: string; x: number; y: number }[],
  frame: Frame,
  obstacles: LabelObstacles,
  routes: TransitMapData["routes"],
  measure: TextMeasurer,
  metrics: LabelMetrics,
  overrides: Record<string, LabelOverride>
): ExportStation[] {
  const byId = new Map(stations.map((s) => [s.id, s]));
  const posById = new Map(stations.map((s) => [s.id, [s.x, s.y] as [number, number]]));
  const placedLabels: Box[] = [];
  const result = new Map<string, ExportStation>();

  const widthOf = (name: string) => measure(name, metrics.style);
  // What each label ended up as, so the repair pass below can score a station's
  // current slot against its alternatives without re-deriving it.
  const placement = new Map<string, { box: Box; axis: number }>();

  const place = (
    id: string,
    angle: number,
    box: Box,
    labelX: number,
    labelY: number,
    anchor: TextAnchor,
    axis: number
  ) => {
    const s = byId.get(id)!;
    placedLabels.push(box);
    placement.set(id, { box, axis });
    result.set(id, {
      id: s.id,
      name: s.name,
      x: s.x,
      y: s.y,
      labelX,
      labelY,
      textAnchor: anchor,
      ...(angle !== 0 ? { rotate: angle } : {}),
    });
  };

  // Overrides are settled first, so the run pass sees them as fixed points and
  // lays its combs around them rather than fighting for the same space.
  for (const station of stations) {
    const override = overrides[station.id];
    if (!override) continue;
    if (override.hidden) {
      result.set(station.id, {
        id: station.id,
        name: station.name,
        x: station.x,
        y: station.y,
        labelX: station.x,
        labelY: station.y,
        labelHidden: true,
      });
      continue;
    }
    if (override.angle !== undefined) {
      const placed = placeAtAngle(station, widthOf(station.name), override.angle, metrics);
      placedLabels.push(placed.box);
      placement.set(station.id, { box: placed.box, axis: 90 });
      result.set(station.id, {
        id: station.id,
        name: station.name,
        x: station.x,
        y: station.y,
        labelX: placed.labelX,
        labelY: placed.labelY,
        textAnchor: placed.anchor,
        labelAngle: override.angle,
        ...(placed.rotate !== 0 ? { rotate: placed.rotate } : {}),
      });
    }
  }

  const runs = buildLabelRuns(routes, posById).sort((a, b) => b.ids.length - a.ids.length);

  for (const run of runs) {
    const ids = run.ids.filter((id) => byId.has(id) && !result.has(id));
    if (ids.length === 0) continue;

    const angles = axisLabelAngles(run.axis);
    // The whole comb can also step outward together — it stays as tidy, and it
    // is often the only way a trunk's names clear the routes crossing it.
    const plans = angles.flatMap((angle, angleIndex) =>
      ([1, -1] as const).flatMap((side) =>
        LABEL_RINGS.map((ring, ringIndex) => {
          const placements = ids.map((id) => {
            const s = byId.get(id)!;
            return schematicPlacement(s.x, s.y, widthOf(s.name), run.axis, angle, side, ring, metrics);
          });
          // Prefer the first (more readable) angle and, all else equal, the
          // +side and the near ring. Costs are averaged over the run so a long
          // trunk isn't scored on sheer length against a short one — the
          // comparison is only ever between this run's own options, and every
          // one of them covers the same stops.
          const penalties = placements.map((p) => placementCost(p.box, frame, obstacles, placedLabels, metrics.padding));
          const mean = penalties.reduce((sum, value) => sum + value, 0) / Math.max(1, penalties.length);
          const cost =
            mean +
            angleIndex * SCHEMATIC_ANGLE_PENALTY +
            (side === 1 ? 0 : SCHEMATIC_SIDE_PENALTY) +
            ringIndex * SCHEMATIC_RING_PENALTY;
          return { angle, placements, cost };
        })
      )
    );
    const chosen = plans.reduce((a, b) => (b.cost < a.cost ? b : a));
    ids.forEach((id, i) => {
      const p = chosen.placements[i];
      place(id, chosen.angle, p.box, p.labelX, p.labelY, p.anchor, run.axis);
    });
  }

  // Stations on no line (isolated dots): a plain horizontal label to the right.
  for (const s of stations) {
    if (result.has(s.id)) continue;
    const p = schematicPlacement(s.x, s.y, widthOf(s.name), 90, 0, -1, 1, metrics);
    place(s.id, 0, p.box, p.labelX, p.labelY, p.anchor, 90);
  }

  // Repair pass. A run commits to one angle and one side for every stop on it,
  // which is what makes a trunk read as a tidy comb — but it also means a stop
  // whose own slot is fouled (by a crossing route, or by another run's comb)
  // cannot be fixed while its run is being placed. Those few are re-placed on
  // their own here. Two names stepped out of a comb still reads as a comb, and
  // beats printing over the track.
  for (const station of stations) {
    // Never second-guess a hand-placed label.
    if (overrides[station.id]) continue;
    const current = placement.get(station.id);
    if (!current) continue;
    // Everything except this label's own box, so it isn't scored against itself.
    const others = placedLabels.filter((box) => box !== current.box);
    const currentCost = placementCost(current.box, frame, obstacles, others, metrics.padding);
    if (currentCost === 0) continue;

    const width = widthOf(station.name);
    const options = axisLabelAngles(current.axis).flatMap((angle, angleIndex) =>
      ([1, -1] as const).flatMap((side) =>
        LABEL_RINGS.map((ring, ringIndex) => {
          const p = schematicPlacement(station.x, station.y, width, current.axis, angle, side, ring, metrics);
          const cost =
            placementCost(p.box, frame, obstacles, others, metrics.padding) +
            angleIndex * SCHEMATIC_ANGLE_PENALTY +
            (side === 1 ? 0 : SCHEMATIC_SIDE_PENALTY) +
            ringIndex * SCHEMATIC_RING_PENALTY;
          return { cost, angle, p };
        })
      )
    );

    const chosen = options.reduce((a, b) => (b.cost < a.cost ? b : a));
    // Only move it if the alternative is genuinely better — the run's own choice
    // wins ties, so a label never leaves its comb for nothing.
    if (chosen.cost >= currentCost) continue;

    const index = placedLabels.indexOf(current.box);
    if (index >= 0) placedLabels[index] = chosen.p.box;
    placement.set(station.id, { box: chosen.p.box, axis: current.axis });
    result.set(station.id, {
      ...result.get(station.id)!,
      labelX: chosen.p.labelX,
      labelY: chosen.p.labelY,
      textAnchor: chosen.p.anchor,
      ...(chosen.angle !== 0 ? { rotate: chosen.angle } : { rotate: undefined }),
    });
  }

  return stations.map((s) => result.get(s.id)!);
}

/** Distinct routes in the order they were added — one legend row each. */
function distinctRoutes(data: TransitMapData): { name: string; color: string }[] {
  const seen = new Set<string>();
  const distinct: { name: string; color: string }[] = [];
  for (const route of data.routes) {
    if (seen.has(route.id)) continue;
    seen.add(route.id);
    distinct.push({ name: route.name, color: route.routeColor });
  }
  return distinct;
}

// The card's outer size, derived from the rows it holds. The reserved band and
// the drawn card both read from this, so the map never overlaps its own legend.
function legendCardSize(
  distinct: { name: string; color: string }[],
  measure: TextMeasurer
): { width: number; height: number } {
  const widestName = Math.max(0, ...distinct.map((d) => measure(d.name, LEGEND_LABEL_STYLE)));
  const rowWidth = LEGEND_SWATCH_LEN_PX + LEGEND_SWATCH_GAP_PX + widestName;
  const headingWidth = measure(LEGEND_HEADING_TEXT, LEGEND_HEADING_STYLE);
  const contentWidth = Math.max(rowWidth, headingWidth);
  const contentHeight = LEGEND_HEADING_FONT_SIZE_PX + LEGEND_HEADING_GAP_PX + distinct.length * LEGEND_ROW_HEIGHT_PX;
  return {
    width: contentWidth + LEGEND_CARD_PADDING_PX * 2,
    height: contentHeight + LEGEND_CARD_PADDING_PX * 2,
  };
}

/**
 * Lays out the legend as rows inside a bottom-left card: a heading, then one
 * swatch+name row per distinct line. The card's bottom edge sits just above the
 * footer band. Null when the map has no lines (no card is drawn).
 */
function buildLegend(
  data: TransitMapData,
  heightPx: number,
  marginPx: number,
  measure: TextMeasurer
): { entries: LegendEntry[]; card: LegendCard } | null {
  const distinct = distinctRoutes(data);
  if (distinct.length === 0) return null;

  const { width, height } = legendCardSize(distinct, measure);
  const cardX = marginPx;
  const cardY = heightPx - marginPx - FOOTER_AREA_PX - height;

  const contentX = cardX + LEGEND_CARD_PADDING_PX;
  const contentTop = cardY + LEGEND_CARD_PADDING_PX;
  const headingY = contentTop + LEGEND_HEADING_FONT_SIZE_PX * 0.8;
  const rowsTop = contentTop + LEGEND_HEADING_FONT_SIZE_PX + LEGEND_HEADING_GAP_PX;

  const entries = distinct.map((entry, i) => ({
    name: entry.name,
    color: entry.color,
    x: contentX,
    y: rowsTop + (i + 0.5) * LEGEND_ROW_HEIGHT_PX,
  }));

  return {
    entries,
    card: { x: cardX, y: cardY, width, height, heading: LEGEND_HEADING_TEXT, headingX: contentX, headingY },
  };
}

/**
 * Projects the current map's lines and stations into a fixed-size, print-DPI
 * pixel space: uniformly scaled to fit the target size (never independent
 * x/y scaling, which would un-45° the octilinear bends), Y-flipped (Mercator
 * y increases north; image y increases downward), and with per-line-run
 * offsets baked directly into the coordinates (there's no static equivalent
 * of Mapbox's live line-offset paint property, so this recreates it as real
 * geometry instead). Reserves extra space at the top (for the map's title,
 * when set) and bottom (for the domain footer, always shown, and the legend
 * when there are lines) beyond the base margin, so the map content never
 * overlaps any of them.
 */
export function computeExportLayout(
  data: TransitMapData,
  sizeId: PrintSizeId,
  mode: LayoutMode = "geographic",
  options: { measureText?: TextMeasurer; labelFontSizePx?: number } = {}
): ExportLayout {
  // Injectable so a caller (and the tests) can pin exact metrics; the default
  // asks the real font wherever a canvas exists.
  const measure = options.measureText ?? defaultTextMeasurer();
  // The print panel dials this up and down; everything that scales with type
  // size is derived from it once, here.
  const metrics = labelMetrics(options.labelFontSizePx ?? LABEL_FONT_SIZE_PX);
  const overrides = data.labelOverrides ?? {};
  const size = PRINT_SIZES.find((s) => s.id === sizeId) ?? PRINT_SIZES[0];
  const widthPx = Math.round(size.widthIn * EXPORT_DPI);
  const heightPx = Math.round(size.heightIn * EXPORT_DPI);
  const marginPx = MARGIN_IN * EXPORT_DPI;
  const legendResult = buildLegend(data, heightPx, marginPx, measure);
  const legendHeightPx = legendResult ? legendResult.card.height : 0;
  const topMarginPx = marginPx + (data.title ? TITLE_AREA_PX : 0);
  const bottomMarginPx = marginPx + FOOTER_AREA_PX + legendHeightPx + LABEL_BOTTOM_ALLOWANCE_PX;
  const sideLabelMarginPx = marginPx + labelSideAllowance(metrics.fontSizePx);

  const legend = legendResult?.entries;
  const legendCard = legendResult?.card;

  // Schematic mode lays every station out on an abstract plane up front, then
  // routes edges through those planar positions. Geographic mode is untouched:
  // it routes in lng/lat and projects afterwards.
  const schematic = mode === "schematic";
  const positions = schematic ? computeSchematicPositions(data) : null;
  const planeOf = (stop: Stop): [number, number] =>
    positions?.get(stop.id) ?? project(stop.lng, stop.lat);
  const routeEdge: EdgeRouter | undefined = schematic
    ? (a, b) => octilinearPathPlane(planeOf(a), planeOf(b))
    : undefined;

  const runs = buildRouteRuns(data, routeEdge);
  const projectedRuns = runs.map((run) => ({
    ...run,
    // Schematic runs already carry planar coordinates; geographic ones are lng/lat.
    points: schematic ? run.coordinates : run.coordinates.map(([lng, lat]) => project(lng, lat)),
  }));
  const projectedStations = data.stops.map((stop) => ({
    ...stop,
    projected: planeOf(stop),
  }));

  const allProjectedPoints = [
    ...projectedRuns.flatMap((run) => run.points),
    ...projectedStations.map((station) => station.projected),
  ];

  if (allProjectedPoints.length === 0) {
    return { widthPx, heightPx, title: data.title, labelFontSizePx: metrics.fontSizePx, lines: [], stations: [], legend, legendCard };
  }

  const bbox = boundingBox(allProjectedPoints);
  const bboxWidth = bbox.maxX - bbox.minX;
  const bboxHeight = bbox.maxY - bbox.minY;
  // A label can fall on either side of the map, so reserve the side margin on both edges.
  const availableWidth = widthPx - 2 * sideLabelMarginPx;
  const availableHeight = heightPx - topMarginPx - bottomMarginPx;
  const scale = fitScale(bboxWidth, bboxHeight, availableWidth, availableHeight);
  const contentWidth = bboxWidth * scale;
  const contentHeight = bboxHeight * scale;
  const offsetX = sideLabelMarginPx + (availableWidth - contentWidth) / 2;
  const offsetY = bottomMarginPx + (availableHeight - contentHeight) / 2;

  function toCanvas([x, y]: [number, number]): [number, number] {
    const canvasX = offsetX + (x - bbox.minX) * scale;
    const canvasY = heightPx - (offsetY + (y - bbox.minY) * scale);
    return [canvasX, canvasY];
  }

  // Inverse of toCanvas: which projected point sits under a canvas pixel. Only
  // exact in geographic mode, where the canvas is a uniform-scaled Web Mercator
  // (the same projection a Mapbox raster uses), so a basemap requested for these
  // bounds lands pixel-aligned behind the artwork.
  function fromCanvas(cx: number, cy: number): [number, number] {
    const x = bbox.minX + (cx - offsetX) / scale;
    const y = bbox.minY + (heightPx - cy - offsetY) / scale;
    return [x, y];
  }
  // Full-bleed: the sheet's four corners, not just the drawn content, so the
  // land/water fill runs edge to edge under the floating cards (as on the
  // Vignelli sheet).
  const [minLng, maxLat] = unproject(...fromCanvas(0, 0));
  const [maxLng, minLat] = unproject(...fromCanvas(widthPx, heightPx));
  const geoBounds: GeoBounds | undefined = schematic
    ? undefined
    : { minLng, minLat, maxLng, maxLat };

  const lines = projectedRuns.map((run) => {
    const canvasPoints = run.points.map(toCanvas);
    const exportOffsetPixels = (run.offsetPixels / OFFSET_STEP_PX) * EXPORT_OFFSET_STEP_PX;
    return {
      routeId: run.routeId,
      color: run.color,
      points: offsetPolyline(canvasPoints, exportOffsetPixels),
    };
  });

  const canvasStations = projectedStations.map((station) => {
    const [x, y] = toCanvas(station.projected);
    return { id: station.id, name: station.name, x, y };
  });

  // What a label has to dodge, in the same canvas space it will be placed in.
  const dotClear = STATION_RADIUS_PX + STATION_STROKE_WIDTH_PX / 2;
  const obstacles: LabelObstacles = {
    dots: canvasStations.map((s) => ({
      minX: s.x - dotClear,
      maxX: s.x + dotClear,
      minY: s.y - dotClear,
      maxY: s.y + dotClear,
    })),
    segments: lines.flatMap((line) =>
      line.points.slice(1).map((point, i) => ({
        ax: line.points[i][0],
        ay: line.points[i][1],
        bx: point[0],
        by: point[1],
      }))
    ),
    cards: legendCard
      ? [
          {
            minX: legendCard.x,
            maxX: legendCard.x + legendCard.width,
            minY: legendCard.y,
            maxY: legendCard.y + legendCard.height,
          },
        ]
      : [],
  };
  // Labels may use the full sheet inside its margins — including the bands
  // reserved for the title and footer, which the map content itself is kept out
  // of but a label reaching up or down should still respect.
  const frame: Frame = {
    minX: marginPx,
    maxX: widthPx - marginPx,
    minY: topMarginPx,
    maxY: heightPx - marginPx - FOOTER_AREA_PX,
  };

  // Schematic places labels per straight run (one side + angle per run) so a
  // trunk's names don't jump sides; geographic keeps the per-station slots.
  const stations = schematic
    ? placeSchematicLabels(canvasStations, frame, obstacles, data.routes, measure, metrics, overrides)
    : placeLabels(canvasStations, frame, obstacles, data.routes, measure, metrics, overrides);

  return { widthPx, heightPx, title: data.title, labelFontSizePx: metrics.fontSizePx, lines, stations, legend, legendCard, geoBounds };
}
