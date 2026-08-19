import type { GeoBounds } from "./exportGeometry";

// The two stock Mapbox styles the live editor already renders on, so an export
// with a basemap reads like the map you drew it on. Both show land and water in
// clearly different colours (the point of the option); light is the default.
export type BasemapStyle = "light" | "dark";

const MAPBOX_STYLE_ID: Record<BasemapStyle, string> = {
  light: "light-v11",
  dark: "dark-v11",
};

// Mapbox caps a static image at 1280px per side (2560 with @2x). We request the
// largest image that keeps the sheet's aspect ratio inside that cap — an exact
// aspect match means Mapbox fits the bbox with no letterbox padding, so the
// raster routes up with our projected artwork. It's then drawn up to the full
// print size; a flat land/water fill upscales cleanly.
const MAPBOX_MAX_SIDE_PX = 1280;

export function basemapImageSize(
  widthPx: number,
  heightPx: number
): { width: number; height: number } {
  const scale = MAPBOX_MAX_SIDE_PX / Math.max(widthPx, heightPx);
  return {
    width: Math.max(1, Math.round(widthPx * scale)),
    height: Math.max(1, Math.round(heightPx * scale)),
  };
}

/**
 * A Mapbox Static Images API URL for the two-tone basemap covering `bounds`.
 * Uses the bbox form so the viewport matches our export window exactly; the
 * logo/attribution overlays are dropped for a clean poster (credit belongs on
 * the sheet's footer instead).
 */
export function basemapStaticUrl(
  bounds: GeoBounds,
  opts: { style: BasemapStyle; widthPx: number; heightPx: number; token: string }
): string {
  const { width, height } = basemapImageSize(opts.widthPx, opts.heightPx);
  const bbox = [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat]
    .map((n) => n.toFixed(6))
    .join(",");
  const styleId = MAPBOX_STYLE_ID[opts.style];
  const params = new URLSearchParams({
    access_token: opts.token,
    attribution: "false",
    logo: "false",
  });
  return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/[${bbox}]/${width}x${height}@2x?${params.toString()}`;
}

/**
 * Fetches the basemap and returns it as a self-contained data URI. Embedding it
 * (rather than referencing the http URL) keeps the SVG standalone and, crucially,
 * lets the SVG→PNG canvas step run without tainting on an external origin.
 * Browser-only (uses fetch + FileReader).
 */
export async function fetchBasemapDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Basemap request failed: ${response.status}`);
  }
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read basemap image"));
    reader.readAsDataURL(blob);
  });
}
