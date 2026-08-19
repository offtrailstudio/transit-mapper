import { describe, expect, it } from "vitest";
import { computeExportLayout, EXPORT_DPI, PRINT_SIZES } from "./exportGeometry";
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

  it("positions each station's label offset from its dot", () => {
    const data = emptyData({ stops: [point("a", -73.98, 40.75)] });
    const [station] = computeExportLayout(data, "18x24").stations;
    expect(station.labelX).not.toBe(station.x);
    expect(station.labelY).not.toBe(station.y);
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
