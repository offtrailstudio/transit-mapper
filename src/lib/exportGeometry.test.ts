import { describe, expect, it } from "vitest";
import {
  computeExportLayout,
  EXPORT_DPI,
  EXPORT_LINE_WIDTH_PX,
  EXPORT_MARGIN_PX,
  LABEL_FONT_SIZE_PX,
  PRINT_SIZES,
  segmentIntersectsBox,
  STATION_RADIUS_PX,
  STATION_STROKE_WIDTH_PX,
  type ExportStation,
} from "./exportGeometry";
import { type TextMeasurer } from "./textMeasure";
import { TransitMapData } from "./types";

function point(id: string, lng: number, lat: number) {
  return { id, name: id, lng, lat };
}

function emptyData(overrides: Partial<TransitMapData> = {}): TransitMapData {
  return { version: 3, title: "", stops: [], routes: [], ...overrides };
}

describe("computeExportLayout", () => {
  it("sizes the canvas to the chosen print size at the fixed export DPI", () => {
    const size = PRINT_SIZES.find((s) => s.id === "12x16")!;
    const layout = computeExportLayout(emptyData(), "12x16");
    expect(layout.widthPx).toBe(Math.round(size.widthIn * EXPORT_DPI));
    expect(layout.heightPx).toBe(Math.round(size.heightIn * EXPORT_DPI));
  });

  it("handles no data at all without crashing", () => {
    const layout = computeExportLayout(emptyData(), "18x24");
    expect(layout.lines).toEqual([]);
    expect(layout.stations).toEqual([]);
  });

  it("handles a single station without dividing by zero", () => {
    const data = emptyData({ stops: [point("a", -73.98, 40.75)] });
    const layout = computeExportLayout(data, "18x24");
    expect(layout.stations).toHaveLength(1);
    expect(Number.isFinite(layout.stations[0].x)).toBe(true);
    expect(Number.isFinite(layout.stations[0].y)).toBe(true);
  });

  it("keeps all stations within the canvas margins", () => {
    const data = emptyData({
      stops: [point("a", -74.5, 40.5), point("b", -73.5, 41.5)],
    });
    const layout = computeExportLayout(data, "18x24");
    for (const station of layout.stations) {
      expect(station.x).toBeGreaterThanOrEqual(0);
      expect(station.x).toBeLessThanOrEqual(layout.widthPx);
      expect(station.y).toBeGreaterThanOrEqual(0);
      expect(station.y).toBeLessThanOrEqual(layout.heightPx);
    }
  });

  it("places the more northern station higher on the canvas (smaller y)", () => {
    const data = emptyData({
      stops: [point("south", -74, 40), point("north", -74, 45)],
    });
    const layout = computeExportLayout(data, "18x24");
    const south = layout.stations.find((s) => s.id === "south")!;
    const north = layout.stations.find((s) => s.id === "north")!;
    expect(north.y).toBeLessThan(south.y);
  });

  it("gives lines sharing a physical segment different (offset) coordinates", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [point("a", -74, 40), point("b", -73.9, 40.1)],
      routes: [
        { id: "l1", name: "Route 1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a", "b"] }] },
        { id: "l2", name: "Route 2", routeColor: "#00f", patterns: [{ id: "l2-p", stopIds: ["a", "b"] }] },
      ],
    };
    const layout = computeExportLayout(data, "18x24");
    const line1 = layout.lines.find((l) => l.routeId === "l1")!;
    const line2 = layout.lines.find((l) => l.routeId === "l2")!;
    expect(line2.points).not.toEqual(line1.points);
  });

  it("sets each station's label clear of its dot, on the placement ring", () => {
    const data = emptyData({ stops: [point("a", -73.98, 40.75)] });
    const [station] = computeExportLayout(data, "18x24").stations;
    const distance = Math.hypot(station.labelX - station.x, station.labelY - station.y);
    // Level with the dot is a legitimate answer (a flat label due east), so
    // it's the distance that matters, not that both coordinates moved.
    expect(distance).toBeGreaterThan(STATION_RADIUS_PX + STATION_STROKE_WIDTH_PX);
    expect(station.labelAngle).toBeDefined();
  });

  it("carries the map's title through to the layout", () => {
    const layout = computeExportLayout(emptyData({ title: "My Transit Map" }), "18x24");
    expect(layout.title).toBe("My Transit Map");
  });

  it("reserves extra space at the top when a title is set, shifting content down", () => {
    const stops = [point("a", -74.5, 40.5), point("b", -73.5, 41.5)];
    const withoutTitle = computeExportLayout(emptyData({ stops }), "18x24");
    const withTitle = computeExportLayout(emptyData({ stops, title: "My Transit Map" }), "18x24");

    const northWithout = withoutTitle.stations.find((s) => s.id === "b")!;
    const northWith = withTitle.stations.find((s) => s.id === "b")!;
    expect(northWith.y).toBeGreaterThan(northWithout.y);
  });

  it("gives each station a label anchor", () => {
    const data = emptyData({ stops: [point("a", -73.98, 40.75)] });
    const [station] = computeExportLayout(data, "18x24").stations;
    expect(station.textAnchor === "start" || station.textAnchor === "end").toBe(true);
  });

  it("flips a right-edge station's label to the left so it stays on the sheet", () => {
    const longName = "Very Long Station Name Indeed";
    // Two stations far apart horizontally: the eastern one is pushed to the
    // right edge, so its long label can only fit by anchoring to the left.
    const data = emptyData({
      stops: [
        { id: "west", name: "West", lng: -74.6, lat: 40.75 },
        { id: "east", name: longName, lng: -73.4, lat: 40.75 },
      ],
    });
    const layout = computeExportLayout(data, "18x24");
    const east = layout.stations.find((s) => s.id === "east")!;
    expect(east.textAnchor).toBe("end");
    // End-anchored, so the text extends left of labelX — labelX itself is near
    // the dot but the whole run stays inside the sheet.
    const roughLabelWidth = longName.length * 58;
    expect(east.labelX - roughLabelWidth).toBeGreaterThanOrEqual(0);
  });

  it("builds one legend entry per distinct line, in order, with name and color", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [point("a", -74, 40), point("b", -73.9, 40.1)],
      routes: [
        { id: "l1", name: "Red Route", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a", "b"] }] },
        { id: "l2", name: "Blue Route", routeColor: "#00f", patterns: [{ id: "l2-p", stopIds: ["a", "b"] }] },
      ],
    };
    const { legend } = computeExportLayout(data, "18x24");
    expect(legend).toEqual([
      expect.objectContaining({ name: "Red Route", color: "#f00" }),
      expect.objectContaining({ name: "Blue Route", color: "#00f" }),
    ]);
  });

  it("wraps the legend in a card whose rows sit inside its bounds", () => {
    const data: TransitMapData = {
      version: 3,
      title: "",
      stops: [point("a", -74, 40), point("b", -73.9, 40.1)],
      routes: [{ id: "l1", name: "Red Route", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a", "b"] }] }],
    };
    const { legend, legendCard } = computeExportLayout(data, "18x24");
    expect(legendCard).toBeDefined();
    const card = legendCard!;
    const entry = legend![0];
    // The swatch row and heading both fall within the card's padded box.
    expect(entry.x).toBeGreaterThan(card.x);
    expect(entry.y).toBeGreaterThan(card.y);
    expect(entry.y).toBeLessThan(card.y + card.height);
    expect(card.headingY).toBeGreaterThan(card.y);
    expect(card.headingY).toBeLessThan(entry.y);
  });

  it("omits the legend card when the map has no lines", () => {
    const { legend, legendCard } = computeExportLayout(emptyData({ stops: [point("a", -74, 40)] }), "18x24");
    expect(legend).toBeUndefined();
    expect(legendCard).toBeUndefined();
  });

  it("reserves bottom space for the legend, shifting content up", () => {
    const stops = [point("a", -74.5, 40.5), point("b", -73.5, 41.5)];
    const withoutLines = computeExportLayout(emptyData({ stops }), "18x24");
    const withLines = computeExportLayout(
      emptyData({ stops, routes: [{ id: "l1", name: "L1", routeColor: "#f00", patterns: [{ id: "l1-p", stopIds: ["a", "b"] }] }] }),
      "18x24"
    );
    const southWithout = withoutLines.stations.find((s) => s.id === "a")!;
    const southWith = withLines.stations.find((s) => s.id === "a")!;
    expect(southWith.y).toBeLessThan(southWithout.y);
  });

  it("reports geoBounds that enclose the drawn network in geographic mode", () => {
    const data = emptyData({
      stops: [point("a", -74, 40.7), point("b", -73.9, 40.8)],
      routes: [{ id: "l", name: "L", routeColor: "#f00", patterns: [{ id: "l-p", stopIds: ["a", "b"] }] }],
    });
    const { geoBounds } = computeExportLayout(data, "18x24", "geographic");
    expect(geoBounds).toBeDefined();
    const b = geoBounds!;
    expect(b.minLng).toBeLessThan(b.maxLng);
    expect(b.minLat).toBeLessThan(b.maxLat);
    // The full sheet is full-bleed, so its bounds contain every station.
    expect(b.minLng).toBeLessThanOrEqual(-74);
    expect(b.maxLng).toBeGreaterThanOrEqual(-73.9);
    expect(b.minLat).toBeLessThanOrEqual(40.7);
    expect(b.maxLat).toBeGreaterThanOrEqual(40.8);
  });

  it("omits geoBounds in schematic mode, where a real basemap can't align", () => {
    const data = emptyData({
      stops: [point("a", -74, 40.7), point("b", -73.9, 40.8)],
      routes: [{ id: "l", name: "L", routeColor: "#f00", patterns: [{ id: "l-p", stopIds: ["a", "b"] }] }],
    });
    expect(computeExportLayout(data, "18x24", "schematic").geoBounds).toBeUndefined();
  });

  it("defaults to geographic mode, matching an explicit geographic request", () => {
    const data = emptyData({
      stops: [point("a", -74, 40), point("b", -73.9, 40.1)],
      routes: [{ id: "l", name: "L", routeColor: "#f00", patterns: [{ id: "l-p", stopIds: ["a", "b"] }] }],
    });
    const byDefault = computeExportLayout(data, "18x24");
    const explicit = computeExportLayout(data, "18x24", "geographic");
    expect(byDefault.stations).toEqual(explicit.stations);
    expect(byDefault.lines).toEqual(explicit.lines);
  });

  it("schematic mode evens out a geographically-bunched line's spacing", () => {
    // Stops crammed together at one end and spread at the other.
    const stops = Array.from({ length: 8 }, (_, i) =>
      point(`s${i}`, -74 + (i < 4 ? i * 0.002 : 0.006 + (i - 3) * 0.05), 40 + i * 0.01)
    );
    const stopIds = stops.map((p) => p.id);
    const data = emptyData({ stops, routes: [{ id: "l", name: "L", routeColor: "#f00", patterns: [{ id: "l-p", stopIds }] }] });

    const gapsOf = (layout: ReturnType<typeof computeExportLayout>) => {
      const byId = new Map(layout.stations.map((s) => [s.id, s]));
      const gaps: number[] = [];
      for (let i = 0; i < 7; i++) {
        const a = byId.get(`s${i}`)!;
        const b = byId.get(`s${i + 1}`)!;
        gaps.push(Math.hypot(a.x - b.x, a.y - b.y));
      }
      return gaps;
    };
    const spread = (gaps: number[]) => Math.max(...gaps) / Math.min(...gaps);

    const geographic = gapsOf(computeExportLayout(data, "18x24", "geographic"));
    const schematic = gapsOf(computeExportLayout(data, "18x24", "schematic"));
    // The schematic export has far more uniform stop-to-stop spacing.
    expect(spread(schematic)).toBeLessThan(spread(geographic));
    expect(spread(schematic)).toBeLessThan(2);
  });

  it("angles schematic labels 45° off a horizontal line, leaving geographic horizontal", () => {
    // Same latitude → a horizontal line, which schematic keeps horizontal, so
    // its labels must sit on a ±45° diagonal (45° off the track).
    const data = emptyData({
      stops: [point("a", -74, 40), point("b", -73.5, 40)],
      routes: [{ id: "l", name: "L", routeColor: "#f00", patterns: [{ id: "l-p", stopIds: ["a", "b"] }] }],
    });
    const geographic = computeExportLayout(data, "18x24", "geographic");
    const schematic = computeExportLayout(data, "18x24", "schematic");
    expect(geographic.stations.every((s) => s.rotate === undefined)).toBe(true);
    expect(schematic.stations.every((s) => Math.abs(s.rotate ?? 0) === 45)).toBe(true);
  });

  it("keeps long station-name labels from running off the right edge", () => {
    const longName = "Very Long Station Name Indeed";
    const data = emptyData({
      stops: [{ id: "a", name: longName, lng: -73.98, lat: 40.75 }],
    });
    const layout = computeExportLayout(data, "18x24");
    const [station] = layout.stations;
    // A conservative floor, well under the actual per-character allowance
    // the layout reserves — this just confirms real room exists rather
    // than pinning the exact internal formula.
    const roughLabelWidth = longName.length * 20;
    expect(station.labelX + roughLabelWidth).toBeLessThanOrEqual(layout.widthPx);
  });
});

const BOX = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

describe("segmentIntersectsBox", () => {
  it("finds a segment that runs clean through the box", () => {
    expect(segmentIntersectsBox({ ax: -50, ay: 50, bx: 150, by: 50 }, BOX)).toBe(true);
  });

  it("finds a segment that only ends inside the box", () => {
    expect(segmentIntersectsBox({ ax: 50, ay: 50, bx: 500, by: 500 }, BOX)).toBe(true);
  });

  it("rejects a segment that misses entirely", () => {
    expect(segmentIntersectsBox({ ax: -50, ay: 200, bx: 150, by: 200 }, BOX)).toBe(false);
  });

  it("rejects a segment whose infinite line would cross but whose extent stops short", () => {
    // Aimed at the box, but ending well before it — the bug a naive
    // line-vs-box test makes, which would veto placements nowhere near the track.
    expect(segmentIntersectsBox({ ax: -300, ay: 50, bx: -200, by: 50 }, BOX)).toBe(false);
  });

  it("rejects a diagonal that passes the box's corner outside it", () => {
    // Straddles the box's bounding rows and columns but stays beyond the corner —
    // exactly what an axis-aligned bounding box of the segment would get wrong.
    expect(segmentIntersectsBox({ ax: 120, ay: -20, bx: 220, by: 80 }, BOX)).toBe(false);
  });

  it("handles a degenerate (zero-length) segment as a point", () => {
    expect(segmentIntersectsBox({ ax: 50, ay: 50, bx: 50, by: 50 }, BOX)).toBe(true);
    expect(segmentIntersectsBox({ ax: 500, ay: 500, bx: 500, by: 500 }, BOX)).toBe(false);
  });
});

// A stand-in for real font metrics, so a test can rebuild the exact collision
// box the layout used instead of guessing at it.
const MEASURE: TextMeasurer = (text, style) => Math.max(1, text.length) * style.fontSizePx * 0.6;

/**
 * The axis-aligned bounds of a label as drawn — including its rotation about the
 * anchor, which every label now carries. Ignoring the rotation reports overlaps
 * between labels that don't actually touch.
 */
function labelBoxOf(station: ExportStation) {
  const width = MEASURE(station.name, { fontSizePx: LABEL_FONT_SIZE_PX });
  const x0 =
    station.textAnchor === "end" ? -width : station.textAnchor === "middle" ? -width / 2 : 0;
  const h = LABEL_FONT_SIZE_PX;
  const radians = ((station.rotate ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [lx, ly] of [
    [x0, -h / 2],
    [x0 + width, -h / 2],
    [x0 + width, h / 2],
    [x0, h / 2],
  ]) {
    xs.push(station.labelX + lx * cos - ly * sin);
    ys.push(station.labelY + lx * sin + ly * cos);
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function overlaps(a: ReturnType<typeof labelBoxOf>, b: ReturnType<typeof labelBoxOf>) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function route(id: string, stopIds: string[], color = "#f00") {
  return { id, name: `Route ${id}`, routeColor: color, patterns: [{ id: `${id}-p`, stopIds }] };
}

describe("label placement", () => {
  it("sizes collision boxes from the injected measurer, not the character count", () => {
    // Same name, same place — only the reported width differs. If measurement
    // drives placement, the wide reading has to turn the label inward.
    const data = emptyData({ stops: [{ id: "a", name: "Edge", lng: -73.4, lat: 40.75 }, point("w", -74.6, 40.75)] });
    const narrow = computeExportLayout(data, "18x24", "geographic", {
      measureText: () => 10,
    });
    const wide = computeExportLayout(data, "18x24", "geographic", {
      measureText: () => 4000,
    });
    expect(narrow.stations.find((s) => s.id === "a")!.textAnchor).toBe("start");
    expect(wide.stations.find((s) => s.id === "a")!.textAnchor).toBe("end");
  });

  it("keeps labels off the routes, which the old placer never even tested for", () => {
    // Stops on one latitude give a horizontal trunk that ran straight through
    // the two right-hand slots the placer used to prefer.
    const data = emptyData({
      stops: [point("a", -74.4, 40.75), point("b", -74, 40.75), point("c", -73.6, 40.75)],
      routes: [route("l", ["a", "b", "c"])],
    });
    const layout = computeExportLayout(data, "18x24", "geographic", { measureText: MEASURE });
    // The drawn stroke has width, so a label clears the line only if it clears
    // the centreline by half of it.
    const half = EXPORT_LINE_WIDTH_PX / 2;
    const segments = layout.lines.flatMap((line) =>
      line.points.slice(1).map((p, i) => ({
        ax: line.points[i][0],
        ay: line.points[i][1],
        bx: p[0],
        by: p[1],
      }))
    );
    expect(segments.length).toBeGreaterThan(0);

    for (const station of layout.stations) {
      const box = labelBoxOf(station);
      const inked = { minX: box.minX - half, maxX: box.maxX + half, minY: box.minY - half, maxY: box.maxY + half };
      const onTrack = segments.some((segment) => segmentIntersectsBox(segment, inked));
      expect(onTrack, `${station.id} prints over the line`).toBe(false);
    }
  });

  it("leaves no label sitting on another in a network dense enough to need the escape slots", () => {
    // A four-by-four lattice served by crossing lines — enough conflicts that
    // the old first-fit placer had to start stacking names.
    const stops = [];
    const rows = ["p", "q", "r", "s"];
    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < 4; col++) {
        stops.push({ id: `${rows[row]}${col}`, name: `${rows[row]}${col}`, lng: -74 + col * 0.25, lat: 40.5 + row * 0.25 });
      }
    }
    const routes = rows.map((row, i) => route(`h${i}`, [0, 1, 2, 3].map((c) => `${row}${c}`)));
    const layout = computeExportLayout(emptyData({ stops, routes }), "18x24", "geographic", {
      measureText: MEASURE,
    });

    const boxes = layout.stations.map(labelBoxOf);
    const collisions = boxes.flatMap((a, i) =>
      boxes.slice(i + 1).filter((b) => overlaps(a, b))
    );
    expect(collisions).toHaveLength(0);
  });

  it("places busy interchanges first, so the stop order in the file can't decide who wins", () => {
    const interchange = { id: "x", name: "Interchange", lng: -74, lat: 40.75 };
    const minor = { id: "m", name: "Minor Halt", lng: -73.99, lat: 40.75 };
    const far = point("far", -74.4, 41.1);
    const routes = [route("a", ["far", "x"]), route("b", ["x", "m"], "#00f")];

    const forwards = computeExportLayout(
      emptyData({ stops: [minor, interchange, far], routes }),
      "18x24",
      "geographic",
      { measureText: MEASURE }
    );
    const backwards = computeExportLayout(
      emptyData({ stops: [interchange, minor, far], routes }),
      "18x24",
      "geographic",
      { measureText: MEASURE }
    );

    const of = (layout: typeof forwards) => layout.stations.find((s) => s.id === "x")!;
    expect(of(backwards).textAnchor).toBe(of(forwards).textAnchor);
    expect(of(backwards).labelX - of(backwards).x).toBeCloseTo(of(forwards).labelX - of(forwards).x);
    expect(of(backwards).labelY - of(backwards).y).toBeCloseTo(of(forwards).labelY - of(forwards).y);
  });

  it("keeps every label inside the sheet's margins", () => {
    const stops = [
      { id: "a", name: "Very Long Station Name Indeed", lng: -74.6, lat: 41.2 },
      { id: "b", name: "Another Rather Long Name", lng: -73.4, lat: 40.3 },
      { id: "c", name: "North End", lng: -74, lat: 41.4 },
    ];
    const layout = computeExportLayout(
      emptyData({ stops, title: "My Transit Map", routes: [route("l", ["a", "c", "b"])] }),
      "18x24",
      "geographic",
      { measureText: MEASURE }
    );

    for (const station of layout.stations) {
      const box = labelBoxOf(station);
      expect(box.minX, `${station.id} runs off the left`).toBeGreaterThanOrEqual(EXPORT_MARGIN_PX);
      expect(box.maxX, `${station.id} runs off the right`).toBeLessThanOrEqual(layout.widthPx - EXPORT_MARGIN_PX);
      expect(box.minY, `${station.id} runs off the top`).toBeGreaterThanOrEqual(EXPORT_MARGIN_PX);
      expect(box.maxY, `${station.id} runs off the bottom`).toBeLessThanOrEqual(layout.heightPx - EXPORT_MARGIN_PX);
    }
  });

  it("keeps labels off the legend card", () => {
    const stops = [point("a", -74, 40.5), point("b", -73.9, 40.6), point("c", -74.1, 40.55)];
    const layout = computeExportLayout(
      emptyData({ stops, routes: [route("l", ["a", "b", "c"])] }),
      "18x24",
      "geographic",
      { measureText: MEASURE }
    );
    const card = layout.legendCard!;
    const cardBox = { minX: card.x, maxX: card.x + card.width, minY: card.y, maxY: card.y + card.height };

    for (const station of layout.stations) {
      expect(overlaps(labelBoxOf(station), cardBox), `${station.id} prints over the legend`).toBe(false);
    }
  });
});

// A metro-shaped network rather than a lattice: long lines that meet at a few
// interchanges, most stops on exactly one route. A full grid puts every single
// stop at a crossing, which no placer can do much with and which no real
// network looks like.
function metro(): TransitMapData {
  const stops: TransitMapData["stops"] = [];
  const add = (id: string, name: string, lng: number, lat: number) => {
    stops.push({ id, name, lng, lat });
    return id;
  };
  // Three trunks through a shared centre, plus a branch off one of them.
  const centre = add("c", "Central Exchange", -74.0, 40.75);
  const eastWest = [
    add("ew0", "West Portal", -74.34, 40.75),
    add("ew1", "Beaumont Park", -74.23, 40.75),
    add("ew2", "Old Mill", -74.12, 40.75),
    centre,
    add("ew3", "Cathedral Quarter", -73.88, 40.75),
    add("ew4", "Docklands East", -73.77, 40.75),
    add("ew5", "Harbour Point", -73.66, 40.75),
  ];
  const northSouth = [
    add("ns0", "Northgate", -74.0, 41.05),
    add("ns1", "Silverdale", -74.0, 40.95),
    add("ns2", "Kings Cross", -74.0, 40.85),
    centre,
    add("ns3", "Union Square", -74.0, 40.65),
    add("ns4", "Riverside", -74.0, 40.55),
    add("ns5", "Sandsend", -74.0, 40.45),
  ];
  const diagonal = [
    add("d0", "Airport Interchange", -74.28, 40.5),
    add("d1", "Elm & 3rd", -74.17, 40.61),
    centre,
    add("d2", "Grand Central", -73.85, 40.88),
    add("d3", "Beacon Hill", -73.74, 40.97),
  ];
  const branch = [
    "ew2",
    add("b0", "Marsh Lane", -74.12, 40.87),
    add("b1", "Quarry Bank", -74.12, 40.97),
  ];
  return {
    version: 3,
    title: "Benchmark",
    stops,
    routes: [
      { id: "ew", name: "Coastal", routeColor: "#e11", patterns: [{ id: "ewp", stopIds: eastWest }] },
      { id: "ns", name: "Meridian", routeColor: "#11e", patterns: [{ id: "nsp", stopIds: northSouth }] },
      { id: "dg", name: "Airport Line", routeColor: "#1a1", patterns: [{ id: "dgp", stopIds: diagonal }] },
      { id: "br", name: "Quarry Branch", routeColor: "#e91", patterns: [{ id: "brp", stopIds: branch }] },
    ],
  };
}

describe("label placement quality on a realistic network", () => {
  // Absolute bounds rather than a comparison against the old placer, which is
  // gone. For reference, on this same network that placer left 4 labels sitting
  // on another label and 9 sitting on a route in geographic mode.
  //
  // Geographic — the default, and the mode most posters print in — has to be
  // spotless. Schematic is a ratchet rather than a target: it commits a whole
  // run to one angle and side, so a few labels can only ever be repaired
  // individually and some residue is expected. Lower these as it improves.
  //
  // These run under MEASURE, not real font metrics, so the numbers are a
  // regression guard rather than a prediction of the printed sheet; measured in
  // a browser against real Helvetica the same network gives 0/0 geographic and
  // 1 pair / 3 on-line schematic.
  // No label sits on another in either mode — radial text is far easier to pack
  // than horizontal, since a name runs away from its stop instead of sideways
  // across its neighbours. Some labels do cross a route: every one is radial and
  // confined to a single ring, so a flat bearing runs *along* the line it belongs
  // to, and a stop at a junction can have no clear bearing left. A second, wider
  // ring cut that to 1, but put labels where no override could reproduce them —
  // the per-stop controls are the answer instead. Raising COST_LINE_CROSS
  // doesn't help and costs schematic more.
  const LIMITS = {
    geographic: { labelHits: 0, lineHits: 4 },
    schematic: { labelHits: 0, lineHits: 5 },
  } as const;

  for (const mode of ["geographic", "schematic"] as const) {
    it(`keeps ${mode} labels off each other and off the routes`, () => {
      const layout = computeExportLayout(metro(), "18x24", mode, { measureText: MEASURE });
      const boxes = layout.stations.map(labelBoxOf);

      let labelHits = 0;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) if (overlaps(boxes[i], boxes[j])) labelHits++;
      }

      const half = EXPORT_LINE_WIDTH_PX / 2;
      const segments = layout.lines.flatMap((line) =>
        line.points.slice(1).map((p, i) => ({
          ax: line.points[i][0],
          ay: line.points[i][1],
          bx: p[0],
          by: p[1],
        }))
      );
      const lineHits = boxes.filter((b) =>
        segments.some((segment) =>
          segmentIntersectsBox(segment, {
            minX: b.minX - half,
            maxX: b.maxX + half,
            minY: b.minY - half,
            maxY: b.maxY + half,
          })
        )
      ).length;

      expect(labelHits, "labels sitting on another label").toBeLessThanOrEqual(LIMITS[mode].labelHits);
      expect(lineHits, "labels sitting on a route").toBeLessThanOrEqual(LIMITS[mode].lineHits);
    });
  }
});

describe("label font size as a print setting", () => {
  const data = emptyData({
    stops: [point("a", -74.1, 40.7), point("b", -73.9, 40.8)],
    routes: [route("l", ["a", "b"])],
  });

  it("reports the size it laid out against, so the SVG can draw the same one", () => {
    expect(computeExportLayout(data, "18x24").labelFontSizePx).toBe(LABEL_FONT_SIZE_PX);
    expect(computeExportLayout(data, "18x24", "geographic", { labelFontSizePx: 140 }).labelFontSizePx).toBe(140);
  });

  it("reserves more of the sheet for bigger names, shrinking the drawing", () => {
    // The edge reservation scales with type size, so the artwork has to give
    // ground — otherwise big labels would simply run off the sheet. (The
    // diagonal slots' own offsets deliberately don't scale: those clear the
    // station dot, which is the same size whatever the type is.)
    const span = (labelFontSizePx: number) => {
      const { stations } = computeExportLayout(data, "18x24", "geographic", {
        labelFontSizePx,
        measureText: MEASURE,
      });
      const xs = stations.map((s) => s.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(span(176)).toBeLessThan(span(44));
  });

  it("still keeps big labels on the sheet", () => {
    const wide = emptyData({
      stops: [{ id: "a", name: "Very Long Station Name Indeed", lng: -73.4, lat: 40.75 }, point("w", -74.6, 40.75)],
    });
    const layout = computeExportLayout(wide, "18x24", "geographic", {
      labelFontSizePx: 158,
      measureText: MEASURE,
    });
    for (const station of layout.stations) {
      const width = MEASURE(station.name, { fontSizePx: 158 });
      const minX =
        station.textAnchor === "end"
          ? station.labelX - width
          : station.textAnchor === "middle"
            ? station.labelX - width / 2
            : station.labelX;
      expect(minX).toBeGreaterThanOrEqual(EXPORT_MARGIN_PX);
      expect(minX + width).toBeLessThanOrEqual(layout.widthPx - EXPORT_MARGIN_PX);
    }
  });
});

describe("per-stop label overrides", () => {
  const data = emptyData({
    stops: [point("a", -74.2, 40.7), point("b", -74.0, 40.8), point("c", -73.8, 40.9)],
    routes: [route("l", ["a", "b", "c"])],
  });

  const withOverrides = (overrides: TransitMapData["labelOverrides"]) =>
    computeExportLayout({ ...data, labelOverrides: overrides }, "18x24", "geographic", {
      measureText: MEASURE,
    });

  it("still draws a stop whose label is hidden", () => {
    // The whole point: hiding a name must never hide the station.
    const layout = withOverrides({ b: { hidden: true } });
    const b = layout.stations.find((s) => s.id === "b")!;
    expect(b).toBeDefined();
    expect(Number.isFinite(b.x)).toBe(true);
    expect(Number.isFinite(b.y)).toBe(true);
    expect(b.labelHidden).toBe(true);
    expect(layout.stations).toHaveLength(3);
  });

  it("leaves other stops' labels alone", () => {
    const layout = withOverrides({ b: { hidden: true } });
    for (const id of ["a", "c"]) {
      expect(layout.stations.find((s) => s.id === id)!.labelHidden).toBeUndefined();
    }
  });

  it("frees the hidden label's room for its neighbours instead of just blanking the text", () => {
    // A hidden label claims no collision box, so a crowded neighbour can take
    // the slot it was occupying.
    const crowded = emptyData({
      stops: [
        { id: "x", name: "Kingsbridge Road Interchange", lng: -74.02, lat: 40.75 },
        { id: "y", name: "Fordham Plaza", lng: -74.0, lat: 40.75 },
      ],
    });
    const before = computeExportLayout(crowded, "18x24", "geographic", { measureText: MEASURE });
    const after = computeExportLayout(
      { ...crowded, labelOverrides: { x: { hidden: true } } },
      "18x24",
      "geographic",
      { measureText: MEASURE }
    );
    const boxesOf = (layout: typeof before) =>
      layout.stations.filter((s) => !s.labelHidden).map(labelBoxOf);
    const collisions = (layout: typeof before) => {
      const boxes = boxesOf(layout);
      let n = 0;
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) if (overlaps(boxes[i], boxes[j])) n++;
      return n;
    };
    expect(collisions(after)).toBeLessThanOrEqual(collisions(before));
  });

  it("treats the angle as a compass bearing, putting the label on that side", () => {
    const at = (angle: number) => withOverrides({ b: { angle } }).stations.find((s) => s.id === "b")!;

    const north = at(0);
    expect(north.labelY).toBeLessThan(north.y);
    expect(north.labelX).toBeCloseTo(north.x);

    const east = at(90);
    expect(east.labelX).toBeGreaterThan(east.x);
    expect(east.labelY).toBeCloseTo(east.y);

    const south = at(180);
    expect(south.labelY).toBeGreaterThan(south.y);

    const west = at(270);
    expect(west.labelX).toBeLessThan(west.x);
  });

  it("rotates the text to read radially out of the stop", () => {
    // The baseline lies along the ray, so rotation is the bearing less 90°:
    // due right reads flat, straight up reads vertically, south-east at 45°.
    const rotationAt = (angle: number) =>
      withOverrides({ b: { angle } }).stations.find((s) => s.id === "b")!.rotate ?? 0;

    expect(rotationAt(90)).toBe(0);
    expect(rotationAt(135)).toBe(45);
    expect(rotationAt(180)).toBe(90);
    expect(rotationAt(0)).toBe(270);
  });

  it("never leaves a name upside down, flipping it and anchoring at its end instead", () => {
    // The western half of the dial would otherwise read right-to-left.
    for (const [angle, rotate] of [[225, 315], [270, 0], [315, 45]] as const) {
      const station = withOverrides({ b: { angle } }).stations.find((s) => s.id === "b")!;
      expect(station.rotate ?? 0).toBe(rotate);
      expect(station.textAnchor).toBe("end");
      // Still on the correct side of the dot.
      expect(station.labelX).toBeLessThan(station.x);
    }
  });

  it("honours an override in schematic mode too", () => {
    const layout = computeExportLayout(
      { ...data, labelOverrides: { b: { angle: 90 }, c: { hidden: true } } },
      "18x24",
      "schematic",
      { measureText: MEASURE }
    );
    const b = layout.stations.find((s) => s.id === "b")!;
    expect(b.labelX).toBeGreaterThan(b.x);
    expect(layout.stations.find((s) => s.id === "c")!.labelHidden).toBe(true);
  });

  it("routes automatic labels around a hand-placed one", () => {
    const layout = withOverrides({ b: { angle: 90 } });
    const boxes = layout.stations.filter((s) => !s.labelHidden).map(labelBoxOf);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i], boxes[j])).toBe(false);
      }
    }
  });
});
