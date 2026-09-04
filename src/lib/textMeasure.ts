/**
 * Text measurement for the print export.
 *
 * A label's collision box is only as good as the width it's built from, and a
 * character-count estimate is off by nearly a factor of two between "Illinois
 * Institute of Technology" and "WWWWWWWW" — which is how labels the placer
 * believed were clear ended up overlapping on the sheet. Where a canvas is
 * available (any browser) we ask the real font; the estimate below stays as the
 * fallback for SSR and for jsdom, whose 2D context is unimplemented.
 */

/** The font every export string is drawn in. Shared with exportSvg.ts, which draws them. */
export const EXPORT_FONT_STACK = "Helvetica, Arial, sans-serif";

export type TextStyle = {
  fontSizePx: number;
  fontWeight?: number;
  /** SVG `letter-spacing`, added per character — the title and legend heading use it. */
  letterSpacingPx?: number;
};

export type TextMeasurer = (text: string, style: TextStyle) => number;

// Mean advance width as a fraction of the font size for the stack above. Only
// reached without a canvas; kept deliberately generous, since under-estimating
// a width is precisely what produces overlap.
const ESTIMATE_RATIO = 0.58;

export function estimateTextWidth(text: string, style: TextStyle): number {
  const chars = Math.max(1, text.length);
  return chars * style.fontSizePx * ESTIMATE_RATIO + chars * (style.letterSpacingPx ?? 0);
}

function measurementContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  try {
    return document.createElement("canvas").getContext("2d");
  } catch {
    return null;
  }
}

/**
 * A measurer backed by a real canvas where one exists, memoized per
 * (text, size, weight, spacing) — the placer asks for the same name once per
 * candidate position, and there are sixteen of those per station.
 */
export function createTextMeasurer(): TextMeasurer {
  const context = measurementContext();
  if (!context) return estimateTextWidth;

  const cache = new Map<string, number>();
  return (text, style) => {
    const weight = style.fontWeight ?? 400;
    const spacing = style.letterSpacingPx ?? 0;
    const key = `${weight}|${style.fontSizePx}|${spacing}|${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    context.font = `${weight} ${style.fontSizePx}px ${EXPORT_FONT_STACK}`;
    const measured = context.measureText(text).width + text.length * spacing;
    // A stub context reports 0 for everything; collapsing every collision box to
    // nothing would be far worse than the estimate.
    const width = measured > 0 ? measured : estimateTextWidth(text, style);
    cache.set(key, width);
    return width;
  };
}

let shared: TextMeasurer | null = null;

/** The process-wide measurer. Built once — creating a canvas per layout is not free. */
export function defaultTextMeasurer(): TextMeasurer {
  shared ??= createTextMeasurer();
  return shared;
}
