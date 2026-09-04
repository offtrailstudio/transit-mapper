import {
  EXPORT_LINE_WIDTH_PX,
  EXPORT_MARGIN_PX,
  ExportLayout,
  LEGEND_FONT_SIZE_PX,
  LEGEND_HEADING_FONT_SIZE_PX,
  LEGEND_SWATCH_GAP_PX,
  LEGEND_SWATCH_LEN_PX,
  STATION_RADIUS_PX,
  STATION_STROKE_WIDTH_PX,
} from "./exportGeometry";
import { EXPORT_FONT_STACK as FONT_STACK } from "./textMeasure";

const BACKGROUND = "#ffffff";
const STATION_FILL = "#ffffff";
const STATION_STROKE = "#1a1a1a";
// The legend card: a Vignelli-style guide box — near-white fill, a heavy dark
// rounded border, sitting on the sheet.
const CARD_FILL = "#ffffff";
const CARD_STROKE = "#1a1a1a";
const CARD_STROKE_WIDTH_PX = 10;
const CARD_CORNER_RADIUS_PX = 56;
const LABEL_HALO_WIDTH_PX = 22;
const LABEL_FILL = "#1a1a1a";
const TITLE_FONT_SIZE_PX = 260;
const TITLE_FILL = "#1a1a1a";
const FOOTER_TEXT = "www.transitleague.com";
const FOOTER_FONT_SIZE_PX = 60;
const FOOTER_FILL = "#737373";

// Station names (and the map title) are free text the user typed, so they
// can contain XML's reserved characters (e.g. "5th Ave & Main") — left
// unescaped, that would produce malformed SVG rather than just a display glitch.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function backgroundElement({ widthPx, heightPx }: ExportLayout): string {
  return `<rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="${BACKGROUND}" />`;
}

// A full-bleed land/water raster behind the artwork. The href is a data URI so
// the SVG stays self-contained (and the PNG rasterizer doesn't taint on an
// external origin). It's requested for exactly this sheet's bounds, so `slice`
// only trims sub-pixel rounding, never real content.
function basemapElement({ widthPx, heightPx }: ExportLayout, basemapHref: string): string {
  return `<image href="${basemapHref}" x="0" y="0" width="${widthPx}" height="${heightPx}" preserveAspectRatio="xMidYMid slice" />`;
}

// Left-justified in the top-left corner, its cap height sitting on the
// uniform top margin.
function titleElement({ title }: ExportLayout): string {
  if (!title) {
    return "";
  }
  const y = EXPORT_MARGIN_PX + TITLE_FONT_SIZE_PX * 0.72;
  return `<text x="${EXPORT_MARGIN_PX}" y="${y.toFixed(2)}" font-family="${FONT_STACK}" font-size="${TITLE_FONT_SIZE_PX}" font-weight="700" letter-spacing="4" fill="${TITLE_FILL}">${escapeXml(title)}</text>`;
}

function footerElement({ widthPx, heightPx }: ExportLayout): string {
  return `<text x="${widthPx / 2}" y="${heightPx - EXPORT_MARGIN_PX}" text-anchor="middle" font-family="${FONT_STACK}" font-size="${FOOTER_FONT_SIZE_PX}" letter-spacing="2" fill="${FOOTER_FILL}">${escapeXml(FOOTER_TEXT)}</text>`;
}

// A map-guide card: a bordered rounded box holding a heading and one row per
// line — each line's colour drawn as a short thick stroke (so it reads as "the
// line", not a generic chip) next to its name.
function legendElements({ legend, legendCard }: ExportLayout): string {
  if (!legend || legend.length === 0) {
    return "";
  }
  const card = legendCard
    ? [
        `<rect x="${legendCard.x.toFixed(2)}" y="${legendCard.y.toFixed(2)}" width="${legendCard.width.toFixed(2)}" height="${legendCard.height.toFixed(2)}" rx="${CARD_CORNER_RADIUS_PX}" ry="${CARD_CORNER_RADIUS_PX}" fill="${CARD_FILL}" stroke="${CARD_STROKE}" stroke-width="${CARD_STROKE_WIDTH_PX}" />`,
        `<text x="${legendCard.headingX.toFixed(2)}" y="${legendCard.headingY.toFixed(2)}" font-family="${FONT_STACK}" font-size="${LEGEND_HEADING_FONT_SIZE_PX}" font-weight="700" letter-spacing="2" fill="${LABEL_FILL}">${escapeXml(legendCard.heading)}</text>`,
      ].join("\n")
    : "";
  const rows = legend
    .map((entry) => {
      const swatch = `<line x1="${entry.x.toFixed(2)}" y1="${entry.y.toFixed(2)}" x2="${(entry.x + LEGEND_SWATCH_LEN_PX).toFixed(2)}" y2="${entry.y.toFixed(2)}" stroke="${entry.color}" stroke-width="${EXPORT_LINE_WIDTH_PX}" stroke-linecap="round" />`;
      const labelX = entry.x + LEGEND_SWATCH_LEN_PX + LEGEND_SWATCH_GAP_PX;
      const label = `<text x="${labelX.toFixed(2)}" y="${entry.y.toFixed(2)}" font-family="${FONT_STACK}" font-size="${LEGEND_FONT_SIZE_PX}" font-weight="600" fill="${LABEL_FILL}" dominant-baseline="middle">${escapeXml(entry.name)}</text>`;
      return `${swatch}\n${label}`;
    })
    .join("\n");
  return card ? `${card}\n${rows}` : rows;
}

function lineElements({ lines }: ExportLayout): string {
  return lines
    .map((line) => {
      const points = line.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
      return `<polyline points="${points}" fill="none" stroke="${line.color}" stroke-width="${EXPORT_LINE_WIDTH_PX}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join("\n");
}

/**
 * Circles and labels stay interleaved per station rather than drawn as two passes,
 * so a neighbouring dot can still overlap an earlier label exactly as it does today —
 * splitting them would silently restack every export.
 */
// A stop whose name isn't printed still gets a marker — it just reads as a
// minor halt rather than a named station, the way a real sheet distinguishes the
// two. Sized so the dot stays legible against the line it sits on.
const MINOR_STATION_RADIUS_PX = Math.round(STATION_RADIUS_PX * 0.55);
const MINOR_STATION_STROKE_WIDTH_PX = Math.round(STATION_STROKE_WIDTH_PX * 0.7);

function stationElements({ stations, labelFontSizePx }: ExportLayout, withLabels: boolean): string {
  return stations
    .map((station) => {
      // Only shrink when the label is genuinely off. The label-less *preview*
      // (buildPreviewSvg) draws no text at all, and every dot there should keep
      // its full size.
      const minor = withLabels && station.labelHidden;
      const radius = minor ? MINOR_STATION_RADIUS_PX : STATION_RADIUS_PX;
      const strokeWidth = minor ? MINOR_STATION_STROKE_WIDTH_PX : STATION_STROKE_WIDTH_PX;
      const circle = `<circle cx="${station.x.toFixed(2)}" cy="${station.y.toFixed(2)}" r="${radius}" fill="${STATION_FILL}" stroke="${STATION_STROKE}" stroke-width="${strokeWidth}" />`;
      if (!withLabels || station.labelHidden) {
        return circle;
      }
      const anchor = station.textAnchor ?? "start";
      const transform = station.rotate
        ? ` transform="rotate(${station.rotate} ${station.labelX.toFixed(2)} ${station.labelY.toFixed(2)})"`
        : "";
      const label = `<text x="${station.labelX.toFixed(2)}" y="${station.labelY.toFixed(2)}" text-anchor="${anchor}"${transform} font-family="${FONT_STACK}" font-size="${labelFontSizePx}" font-weight="600" fill="${LABEL_FILL}" stroke="${BACKGROUND}" stroke-width="${LABEL_HALO_WIDTH_PX}" paint-order="stroke" dominant-baseline="middle">${escapeXml(station.name)}</text>`;
      return `${circle}\n${label}`;
    })
    .join("\n");
}

/**
 * Renders a print-ready SVG string from an already-laid-out export (see
 * `computeExportLayout`). Pass `basemapHref` (a data URI) to drop a land/water
 * raster behind the artwork — only meaningful for a geographic layout.
 */
export function buildExportSvg(layout: ExportLayout, options?: { basemapHref?: string }): string {
  const { widthPx, heightPx } = layout;
  const basemap = options?.basemapHref ? `\n${basemapElement(layout, options.basemapHref)}` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">
${backgroundElement(layout)}${basemap}
${titleElement(layout)}
${footerElement(layout)}
${legendElements(layout)}
${lineElements(layout)}
${stationElements(layout, true)}
</svg>`;
}

const PREVIEW_PADDING_RATIO = 0.08;

/**
 * A square window onto just the drawn content. Framing the full print sheet
 * instead would letterbox a 3:4 page into a square card and then spend most of
 * what's left on the margins, title band, and footer — leaving the actual map a
 * speck in the middle. Square (rather than the content's own aspect) so the card
 * never letterboxes; centred so a wide or tall map still sits in the middle.
 */
export function previewViewBox(layout: ExportLayout): string {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const line of layout.lines) {
    for (const [x, y] of line.points) {
      xs.push(x);
      ys.push(y);
    }
  }
  // Only the dots — the preview draws no labels, so reserving room for their text
  // would just shrink the map inside the card for nothing.
  for (const station of layout.stations) {
    xs.push(station.x);
    ys.push(station.y);
  }

  if (xs.length === 0) {
    return `0 0 ${layout.widthPx} ${layout.heightPx}`;
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  // A lone station has no extent of its own, so fall back to a sane window rather than a zero-size viewBox.
  const side = Math.max(maxX - minX, maxY - minY, layout.labelFontSizePx * 10);
  const padded = side * (1 + PREVIEW_PADDING_RATIO * 2);
  const originX = (minX + maxX) / 2 - padded / 2;
  const originY = (minY + maxY) / 2 - padded / 2;

  return `${originX.toFixed(2)} ${originY.toFixed(2)} ${padded.toFixed(2)} ${padded.toFixed(2)}`;
}

/**
 * Just the routes: lines and station dots, cropped to the content and sized by its
 * container. Labels, title, and footer are all omitted — at thumbnail scale the text
 * is unreadable anyway and only muddies the shape of the network, which is the one
 * thing that tells two maps apart in a grid. Shares the export's own element builders
 * so the geometry can't drift from what prints.
 */
export function buildPreviewSvg(layout: ExportLayout): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="${previewViewBox(layout)}" preserveAspectRatio="xMidYMid meet">
${backgroundElement(layout)}
${lineElements(layout)}
${stationElements(layout, false)}
</svg>`;
}
