/**
 * SVG → PNG, within what the browser will actually give us.
 *
 * A print sheet is enormous in pixels: 18 × 24 in at 300 DPI is 5400 × 7200 =
 * 38.9M px, and 24 × 36 is 77.8M. Chrome allows that; Safari caps a canvas at
 * about 16.7M px total area (iOS lower) and simply hands back a blank or null
 * result instead of throwing. That's why a PNG export could fail on Safari with
 * nothing to show for it. So: find what this browser can really do, and step the
 * raster down to fit rather than asking for the impossible.
 */

const MAX_TEXTURE_SIDE_PX = 32767;
// Never degrade past this; below it the file isn't worth calling a print.
const MIN_SCALE = 0.25;

function canvasWorksAt(width: number, height: number): boolean {
  if (width > MAX_TEXTURE_SIDE_PX || height > MAX_TEXTURE_SIDE_PX) return false;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return false;
  // An over-large canvas doesn't report failure — it silently gives back a
  // surface that reads as transparent. Writing one pixel in the far corner and
  // reading it back is the only reliable check.
  context.fillStyle = "#ffffff";
  context.fillRect(width - 1, height - 1, 1, 1);
  try {
    return context.getImageData(width - 1, height - 1, 1, 1).data[3] === 255;
  } catch {
    return false;
  }
}

/**
 * The largest scale of `width × height` this browser can rasterize, at most 1.
 * Steps down in modest increments so a capable browser still lands on full size
 * and a capped one loses as little resolution as possible.
 */
export function usableRasterScale(width: number, height: number): number {
  for (let scale = 1; scale >= MIN_SCALE; scale -= 0.1) {
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    if (canvasWorksAt(w, h)) {
      return scale;
    }
  }
  return 0;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The sheet could not be rendered for export."));
    image.src = src;
  });
}

export type RasterResult = {
  blob: Blob;
  /** 1 when the sheet rasterized at full print resolution, less when capped. */
  scale: number;
};

/** Rasterizes an SVG string to a PNG Blob, downscaling only if it has to. */
export async function svgToPngBlob(svg: string, widthPx: number, heightPx: number): Promise<RasterResult> {
  const scale = usableRasterScale(widthPx, heightPx);
  if (scale === 0) {
    throw new Error(
      "This browser can't rasterize a sheet this large. Try a smaller paper size, or download SVG instead."
    );
  }

  const width = Math.max(1, Math.round(widthPx * scale));
  const height = Math.max(1, Math.round(heightPx * scale));
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is not available");
    }
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      throw new Error(
        "This browser couldn't produce the PNG. Try a smaller paper size, or download SVG instead."
      );
    }
    return { blob, scale };
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
