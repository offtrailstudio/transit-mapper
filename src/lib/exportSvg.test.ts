import { describe, expect, it } from "vitest";
import { EXPORT_MARGIN_PX, ExportLayout } from "./exportGeometry";
import { buildExportSvg, buildPreviewSvg, previewViewBox } from "./exportSvg";

function layout(overrides: Partial<ExportLayout> = {}): ExportLayout {
  return {
    widthPx: 5400,
    heightPx: 7200,
    title: "",
    labelFontSizePx: 88,
    lines: [],
    stations: [],
    ...overrides,
  };
}

describe("buildExportSvg", () => {
  it("sets the SVG root width, height, and matching viewBox", () => {
    const svg = buildExportSvg(layout());
    expect(svg).toContain('width="5400"');
    expect(svg).toContain('height="7200"');
    expect(svg).toContain('viewBox="0 0 5400 7200"');
  });

  it("always renders the domain footer, even with no title set", () => {
    const svg = buildExportSvg(layout());
    expect(svg).toContain("www.transitleague.com");
  });

  it("renders the title only when one is set", () => {
    const withoutTitle = buildExportSvg(layout());
    expect(withoutTitle.match(/<text/g)).toHaveLength(1); // footer only

    const withTitle = buildExportSvg(layout({ title: "My Transit Map" }));
    expect(withTitle).toContain(">My Transit Map<");
    expect(withTitle.match(/<text/g)).toHaveLength(2); // title + footer
  });

  it("renders one polyline per line, using its color", () => {
    const svg = buildExportSvg(
      layout({
        lines: [
          { routeId: "l1", color: "#ee352e", points: [[0, 0], [100, 100]] },
          { routeId: "l2", color: "#0039a6", points: [[0, 0], [100, 200]] },
        ],
      })
    );
    expect(svg.match(/<polyline/g)).toHaveLength(2);
    expect(svg).toContain('stroke="#ee352e"');
    expect(svg).toContain('stroke="#0039a6"');
  });

  it("renders one circle and one text label per station, plus the footer", () => {
    const svg = buildExportSvg(
      layout({
        stations: [{ id: "a", name: "Grand Central", x: 10, y: 20, labelX: 30, labelY: 40 }],
      })
    );
    expect(svg.match(/<circle/g)).toHaveLength(1);
    expect(svg.match(/<text/g)).toHaveLength(2); // station label + footer
    expect(svg).toContain(">Grand Central<");
  });

  it("draws no keyline frame (no stroked rect)", () => {
    const svg = buildExportSvg(layout());
    expect(svg).not.toMatch(/<rect[^>]*stroke=/);
  });

  it("left-justifies the title at the top-left margin", () => {
    const svg = buildExportSvg(layout({ title: "My Transit Map" }));
    const title = svg.split("\n").find((line) => line.includes(">My Transit Map<"))!;
    expect(title).toContain(`x="${EXPORT_MARGIN_PX}"`);
    // Left-justified: the title (unlike the centered footer) has no middle anchor.
    expect(title).not.toContain('text-anchor="middle"');
  });

  it("renders a legend row per entry, with its color, and none when absent", () => {
    const withLegend = buildExportSvg(
      layout({
        legend: [
          { name: "Red Route", color: "#ee352e", x: 300, y: 6000 },
          { name: "Blue Route", color: "#0039a6", x: 300, y: 6150 },
        ],
      })
    );
    expect(withLegend.match(/<line/g)).toHaveLength(2);
    expect(withLegend).toContain(">Red Route<");
    expect(withLegend).toContain(">Blue Route<");
    expect(withLegend).toContain('stroke="#ee352e"');

    // The default layout has no legend, so no swatch lines are drawn.
    expect(buildExportSvg(layout())).not.toContain("<line");
  });

  it("draws a bordered rounded card with a heading when one is supplied", () => {
    const svg = buildExportSvg(
      layout({
        legend: [{ name: "Red Route", color: "#ee352e", x: 380, y: 6300 }],
        legendCard: {
          x: 300,
          y: 6000,
          width: 1200,
          height: 600,
          heading: "Lines",
          headingX: 380,
          headingY: 6150,
        },
      })
    );
    // A rounded, stroked rect (the card) plus its heading text.
    expect(svg).toMatch(/<rect[^>]*rx="\d+"[^>]*stroke=/);
    expect(svg).toContain(">Lines<");
    // The swatch row still draws inside it.
    expect(svg).toContain(">Red Route<");
  });

  it("draws legend rows without a card when none is supplied", () => {
    const svg = buildExportSvg(
      layout({ legend: [{ name: "Red Route", color: "#ee352e", x: 300, y: 6000 }] })
    );
    expect(svg).toContain(">Red Route<");
    expect(svg).not.toContain(">Lines<");
    expect(svg).not.toMatch(/<rect[^>]*stroke=/);
  });

  it("honours a station's label anchor, defaulting to start", () => {
    const anchored = buildExportSvg(
      layout({ stations: [{ id: "a", name: "West End", x: 10, y: 20, labelX: 30, labelY: 40, textAnchor: "end" }] })
    );
    expect(anchored).toContain('text-anchor="end"');

    const bare = buildExportSvg(
      layout({ stations: [{ id: "a", name: "West End", x: 10, y: 20, labelX: 30, labelY: 40 }] })
    );
    expect(bare).toContain('text-anchor="start"');
  });

  it("rotates a label when the station carries an angle, and not otherwise", () => {
    const angled = buildExportSvg(
      layout({ stations: [{ id: "a", name: "West End", x: 10, y: 20, labelX: 30, labelY: 40, rotate: -45 }] })
    );
    expect(angled).toContain("transform=\"rotate(-45 30.00 40.00)\"");

    const flat = buildExportSvg(
      layout({ stations: [{ id: "a", name: "West End", x: 10, y: 20, labelX: 30, labelY: 40 }] })
    );
    expect(flat).not.toContain("transform=\"rotate");
  });

  it("drops a full-bleed basemap image behind the artwork only when a href is given", () => {
    const withBasemap = buildExportSvg(layout(), { basemapHref: "data:image/png;base64,AAAA" });
    expect(withBasemap).toContain('<image href="data:image/png;base64,AAAA"');
    expect(withBasemap).toContain('width="5400"');
    // Behind everything: the image comes right after the background rect and
    // before the footer text.
    const imageIdx = withBasemap.indexOf("<image");
    const footerIdx = withBasemap.indexOf("www.transitleague.com");
    expect(imageIdx).toBeGreaterThan(-1);
    expect(imageIdx).toBeLessThan(footerIdx);

    expect(buildExportSvg(layout())).not.toContain("<image");
  });

  it("escapes XML-reserved characters in station names and the title", () => {
    const svg = buildExportSvg(
      layout({
        title: "5th Ave & <Main>",
        stations: [{ id: "a", name: "5th Ave & <Main>", x: 0, y: 0, labelX: 0, labelY: 0 }],
      })
    );
    const occurrences = svg.split("5th Ave &amp; &lt;Main&gt;").length - 1;
    expect(occurrences).toBe(2);
    expect(svg).not.toContain("5th Ave & <Main>");
  });
});

describe("buildPreviewSvg", () => {
  it("scales to its container instead of the fixed print size", () => {
    // Only the root tag — the background rect keeps the print dimensions on purpose.
    const root = buildPreviewSvg(layout()).slice(0, buildPreviewSvg(layout()).indexOf(">") + 1);
    expect(root).toContain('width="100%"');
    expect(root).toContain('height="100%"');
    expect(root).not.toContain('width="5400"');
    expect(root).not.toContain('height="7200"');
  });

  it("never stretches the drawing to fill the card", () => {
    expect(buildPreviewSvg(layout())).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("falls back to the full print sheet when there is nothing drawn", () => {
    expect(previewViewBox(layout())).toBe("0 0 5400 7200");
  });

  it("crops to the drawn content instead of framing the whole print sheet", () => {
    const box = previewViewBox(
      layout({
        lines: [{ routeId: "l1", color: "#ee352e", points: [[2000, 3000], [2600, 3600]] }],
      })
    );
    const [x, y, w, h] = box.split(" ").map(Number);
    // The content spans 600px; the full sheet is 5400 wide, so a crop must be far smaller.
    expect(w).toBeLessThan(2000);
    expect(w).toBe(h);
    // ...and must still contain the content it cropped to.
    expect(x).toBeLessThanOrEqual(2000);
    expect(y).toBeLessThanOrEqual(3000);
    expect(x + w).toBeGreaterThanOrEqual(2600);
    expect(y + h).toBeGreaterThanOrEqual(3600);
  });

  it("keeps the window square so a lopsided map still fills the card", () => {
    const box = previewViewBox(
      layout({ lines: [{ routeId: "l1", color: "#000", points: [[0, 0], [4000, 100]] }] })
    );
    const [, , w, h] = box.split(" ").map(Number);
    expect(w).toBe(h);
  });

  it("gives a lone station a usable window rather than a zero-size one", () => {
    const box = previewViewBox(
      layout({ stations: [{ id: "a", name: "X", x: 500, y: 500, labelX: 530, labelY: 530 }] })
    );
    const [, , w, h] = box.split(" ").map(Number);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });


  it("draws the same lines and dots as the print export", () => {
    const args = layout({
      lines: [{ routeId: "l1", color: "#ee352e", points: [[0, 0], [100, 100]] }],
      stations: [{ id: "a", name: "Grand Central", x: 10, y: 20, labelX: 30, labelY: 40 }],
    });
    const preview = buildPreviewSvg(args);
    const exported = buildExportSvg(args);
    const polyline = /<polyline[^>]*>/g;
    const circle = /<circle[^>]*>/g;
    expect(preview.match(polyline)).toEqual(exported.match(polyline));
    expect(preview.match(circle)).toEqual(exported.match(circle));
  });

  it("omits station labels, the title, and the footer", () => {
    const svg = buildPreviewSvg(
      layout({
        title: "My Transit Map",
        stations: [{ id: "a", name: "Grand Central", x: 10, y: 20, labelX: 30, labelY: 40 }],
      })
    );
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("Grand Central");
    expect(svg).not.toContain("My Transit Map");
    expect(svg).not.toContain("www.transitleague.com");
  });

  it("does not reserve label width when framing the content", () => {
    const station = { id: "a", x: 1000, y: 1000, labelX: 1030, labelY: 1030 };
    const short = previewViewBox(layout({ stations: [{ ...station, name: "A" }] }));
    const long = previewViewBox(
      layout({ stations: [{ ...station, name: "Very Long Station Name Indeed" }] })
    );
    expect(long).toBe(short);
  });
});

describe("label size travels on the layout", () => {
  it("draws station labels at the size the layout was measured against", () => {
    const station = { id: "a", name: "Alpha", x: 100, y: 100, labelX: 140, labelY: 140, textAnchor: "start" as const };
    const svg = buildExportSvg(layout({ labelFontSizePx: 130, stations: [station] }));
    expect(svg).toContain('font-size="130"');
    // The default must not leak back in — that mismatch is exactly how a
    // "bigger labels" setting would silently reintroduce overlap.
    expect(svg).not.toContain('font-size="88"');
  });
});

describe("stops whose label is hidden", () => {
  const named = { id: "a", name: "Alpha", x: 100, y: 100, labelX: 190, labelY: 100, textAnchor: "start" as const };
  const unnamed = { id: "b", name: "Beta", x: 400, y: 400, labelX: 400, labelY: 400, labelHidden: true };

  it("still draws the stop", () => {
    // Hiding a name must never hide the station.
    const svg = buildExportSvg(layout({ stations: [unnamed] }));
    expect(svg).toContain("<circle");
  });

  it("omits only the name", () => {
    const svg = buildExportSvg(layout({ stations: [named, unnamed] }));
    expect(svg).toContain(">Alpha<");
    expect(svg).not.toContain(">Beta<");
  });

  it("draws it smaller, so it reads as a minor halt beside a named station", () => {
    const svg = buildExportSvg(layout({ stations: [named, unnamed] }));
    const radii = [...svg.matchAll(/<circle[^>]*\br="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(radii).toHaveLength(2);
    expect(Math.min(...radii)).toBeLessThan(Math.max(...radii));
  });

  it("keeps every dot full size in the label-less thumbnail", () => {
    // buildPreviewSvg draws no text at all, so there is no named/unnamed
    // distinction to make — shrinking there would just lose stops in the grid.
    const svg = buildPreviewSvg(layout({ stations: [named, unnamed] }));
    const radii = new Set([...svg.matchAll(/<circle[^>]*\br="([\d.]+)"/g)].map((m) => m[1]));
    expect(radii.size).toBe(1);
  });
});
