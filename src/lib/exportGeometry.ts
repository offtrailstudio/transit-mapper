import { offsetPolyline } from "./offsetPolyline";
import { buildRouteRuns, EdgeRouter, LINE_WIDTH_PX, OFFSET_STEP_PX } from "./lineGeometry";
import { primaryStopIds } from "./lines";
import { octilinearPathPlane, project, unproject } from "./octilinear";
import { computeSchematicPositions } from "./schematicLayout";
import { Stop, TransitMapData } from "./types";

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
// Rough advance widths (uppercase-ish heading runs wider than the mixed-case
// rows). Only used to size the card so text doesn't overrun its border — the
// same heuristic the label placer already trusts, never real font metrics.
const LEGEND_LABEL_CHAR_WIDTH_PX = LEGEND_FONT_SIZE_PX * 0.58;
const LEGEND_HEADING_CHAR_WIDTH_PX = LEGEND_HEADING_FONT_SIZE_PX * 0.64;

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
// A label can land on either side of its dot, so both the right and left
// edges need room for the longest name; scales with the longest name in the map.
const AVG_LABEL_CHAR_WIDTH_PX = LABEL_FONT_SIZE_PX * 0.58;
// A label can fall on either side of its dot, so reserve room on both edges —
// but only a moderate, fixed allowance rather than the full longest name. The
// placement pass already flips a label to whichever side has room and prefers
// staying inside the frame, so an edge station's name turns inward instead of
// demanding a reservation the width of the map's longest name (which used to
// shrink the drawing to a fraction of the sheet).
const LABEL_SIDE_ALLOWANCE_PX = AVG_LABEL_CHAR_WIDTH_PX * 8;
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
  // computeExportLayout always sets it (see placeLabels).
  textAnchor?: "start" | "end";
  // Degrees to rotate the label about (labelX, labelY). Schematic mode angles
  // labels at -45° (the Vignelli up-to-the-right diagonal); geographic leaves
  // this undefined (horizontal).
  rotate?: number;
};

export type ExportLayout = {
  widthPx: number;
  heightPx: number;
  title: string;
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

type Box = { minX: number; maxX: number; minY: number; maxY: number };

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

type LabelCandidate = { dx: number; dy: number; anchor: "start" | "end"; angle: number };

// Axis-aligned bounds of a label rectangle after rotating it by `angle`
// degrees about its anchor (labelX, labelY). At angle 0 this is exactly the
// old horizontal box, so the geographic layout is unchanged; the rotation is
// the same one SVG applies via rotate(angle, labelX, labelY).
function labelBox(labelX: number, labelY: number, width: number, anchor: "start" | "end", angle: number): Box {
  const h = LABEL_FONT_SIZE_PX;
  const x0 = anchor === "end" ? -width : 0;
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

// Geographic: horizontal text at four diagonal slots (down-right first, so a
// lone station reads exactly as it always has).
const HORIZONTAL_CANDIDATES: LabelCandidate[] = [
  { dx: LABEL_OFFSET_X_PX, dy: LABEL_OFFSET_Y_PX, anchor: "start", angle: 0 },
  { dx: LABEL_OFFSET_X_PX, dy: -LABEL_OFFSET_Y_PX, anchor: "start", angle: 0 },
  { dx: -LABEL_OFFSET_X_PX, dy: LABEL_OFFSET_Y_PX, anchor: "end", angle: 0 },
  { dx: -LABEL_OFFSET_X_PX, dy: -LABEL_OFFSET_Y_PX, anchor: "end", angle: 0 },
];

// The offset from a dot to its angled label's anchor, along the perpendicular
// to the line, so the name sits clear of the track.
const ANGLED_OFFSET_PX = STATION_RADIUS_PX + STATION_STROKE_WIDTH_PX + LABEL_GAP_PX;

/**
 * Geographic label placement: horizontal text dropped into whichever of four
 * diagonal slots first clears every dot and already-placed label.
 */
function placeLabels(
  stations: { id: string; name: string; x: number; y: number }[],
  widthPx: number
): ExportStation[] {
  const dotClear = STATION_RADIUS_PX + STATION_STROKE_WIDTH_PX / 2;
  const minX = EXPORT_MARGIN_PX;
  const maxX = widthPx - EXPORT_MARGIN_PX;
  const placed: Box[] = stations.map((s) => ({
    minX: s.x - dotClear,
    maxX: s.x + dotClear,
    minY: s.y - dotClear,
    maxY: s.y + dotClear,
  }));

  return stations.map((station) => {
    const width = Math.max(1, station.name.length) * AVG_LABEL_CHAR_WIDTH_PX;
    const scored = HORIZONTAL_CANDIDATES.map((candidate) => {
      const labelX = station.x + candidate.dx;
      const labelY = station.y + candidate.dy;
      const box = labelBox(labelX, labelY, width, candidate.anchor, candidate.angle);
      const inBounds = box.minX >= minX && box.maxX <= maxX;
      const clear = !placed.some((other) => boxesOverlap(box, other));
      return { candidate, labelX, labelY, box, inBounds, clear };
    });
    const chosen =
      scored.find((s) => s.clear && s.inBounds) ?? scored.find((s) => s.inBounds) ?? scored[0];
    placed.push(chosen.box);
    return {
      id: station.id,
      name: station.name,
      x: station.x,
      y: station.y,
      labelX: chosen.labelX,
      labelY: chosen.labelY,
      textAnchor: chosen.candidate.anchor,
      ...(chosen.candidate.angle !== 0 ? { rotate: chosen.candidate.angle } : {}),
    };
  });
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
  side: 1 | -1
): { labelX: number; labelY: number; anchor: "start" | "end"; box: Box } {
  const perp = ((axis + 90) * Math.PI) / 180;
  const nx = Math.cos(perp) * side;
  const ny = Math.sin(perp) * side;
  const off = ANGLED_OFFSET_PX + LABEL_FONT_SIZE_PX / 2;
  const labelX = x + nx * off;
  const labelY = y + ny * off;
  const rad = (angle * Math.PI) / 180;
  const anchor: "start" | "end" = Math.cos(rad) * nx + Math.sin(rad) * ny >= 0 ? "start" : "end";
  return { labelX, labelY, anchor, box: labelBox(labelX, labelY, width, anchor, angle) };
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
  widthPx: number,
  routes: TransitMapData["routes"]
): ExportStation[] {
  const dotClear = STATION_RADIUS_PX + STATION_STROKE_WIDTH_PX / 2;
  const minX = EXPORT_MARGIN_PX;
  const maxX = widthPx - EXPORT_MARGIN_PX;
  const byId = new Map(stations.map((s) => [s.id, s]));
  const posById = new Map(stations.map((s) => [s.id, [s.x, s.y] as [number, number]]));
  const placed: Box[] = stations.map((s) => ({
    minX: s.x - dotClear,
    maxX: s.x + dotClear,
    minY: s.y - dotClear,
    maxY: s.y + dotClear,
  }));
  const result = new Map<string, ExportStation>();

  const widthOf = (name: string) => Math.max(1, name.length) * AVG_LABEL_CHAR_WIDTH_PX;

  const place = (id: string, angle: number, box: Box, labelX: number, labelY: number, anchor: "start" | "end") => {
    const s = byId.get(id)!;
    placed.push(box);
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

  const runs = buildLabelRuns(routes, posById).sort((a, b) => b.ids.length - a.ids.length);

  for (const run of runs) {
    const ids = run.ids.filter((id) => byId.has(id) && !result.has(id));
    if (ids.length === 0) continue;

    const angles = axisLabelAngles(run.axis);
    const plans = angles.flatMap((angle, angleIndex) =>
      ([1, -1] as const).map((side) => {
        const placements = ids.map((id) => {
          const s = byId.get(id)!;
          return schematicPlacement(s.x, s.y, widthOf(s.name), run.axis, angle, side);
        });
        // Prefer the first (more readable) angle and, all else equal, the +side.
        let cost = angleIndex * 0.5 + (side === 1 ? 0 : 0.1);
        for (const p of placements) {
          if (p.box.minX < minX || p.box.maxX > maxX) cost += 3;
          if (placed.some((q) => boxesOverlap(p.box, q))) cost += 1;
        }
        return { angle, placements, cost };
      })
    );
    const chosen = plans.reduce((a, b) => (b.cost < a.cost ? b : a));
    ids.forEach((id, i) => {
      const p = chosen.placements[i];
      place(id, chosen.angle, p.box, p.labelX, p.labelY, p.anchor);
    });
  }

  // Stations on no line (isolated dots): a plain horizontal label to the right.
  for (const s of stations) {
    if (result.has(s.id)) continue;
    const p = schematicPlacement(s.x, s.y, widthOf(s.name), 90, 0, -1);
    place(s.id, 0, p.box, p.labelX, p.labelY, p.anchor);
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
function legendCardSize(distinct: { name: string; color: string }[]): { width: number; height: number } {
  const maxNameLen = Math.max(1, ...distinct.map((d) => d.name.length));
  const rowWidth = LEGEND_SWATCH_LEN_PX + LEGEND_SWATCH_GAP_PX + maxNameLen * LEGEND_LABEL_CHAR_WIDTH_PX;
  const headingWidth = LEGEND_HEADING_TEXT.length * LEGEND_HEADING_CHAR_WIDTH_PX;
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
  marginPx: number
): { entries: LegendEntry[]; card: LegendCard } | null {
  const distinct = distinctRoutes(data);
  if (distinct.length === 0) return null;

  const { width, height } = legendCardSize(distinct);
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
  mode: LayoutMode = "geographic"
): ExportLayout {
  const size = PRINT_SIZES.find((s) => s.id === sizeId) ?? PRINT_SIZES[0];
  const widthPx = Math.round(size.widthIn * EXPORT_DPI);
  const heightPx = Math.round(size.heightIn * EXPORT_DPI);
  const marginPx = MARGIN_IN * EXPORT_DPI;
  const legendResult = buildLegend(data, heightPx, marginPx);
  const legendHeightPx = legendResult ? legendResult.card.height : 0;
  const topMarginPx = marginPx + (data.title ? TITLE_AREA_PX : 0);
  const bottomMarginPx = marginPx + FOOTER_AREA_PX + legendHeightPx + LABEL_BOTTOM_ALLOWANCE_PX;
  const sideLabelMarginPx = marginPx + LABEL_SIDE_ALLOWANCE_PX;

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
    return { widthPx, heightPx, title: data.title, lines: [], stations: [], legend, legendCard };
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
  // Schematic places labels per straight run (one side + angle per run) so a
  // trunk's names don't jump sides; geographic keeps the per-station slots.
  const stations = schematic
    ? placeSchematicLabels(canvasStations, widthPx, data.routes)
    : placeLabels(canvasStations, widthPx);

  return { widthPx, heightPx, title: data.title, lines, stations, legend, legendCard, geoBounds };
}
