import { afterEach, describe, expect, it, vi } from "vitest";
import { usableRasterScale } from "./exportRaster";

/**
 * Stands in for a browser's canvas limit. A real over-large canvas doesn't
 * throw — it hands back a surface that reads as transparent, which is exactly
 * why the probe writes a pixel and reads it back.
 */
function stubCanvasLimit(maxArea: number) {
  const real = document.createElement.bind(document);
  return vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag !== "canvas") return real(tag as "div");
    const canvas = { width: 0, height: 0 } as { width: number; height: number };
    return {
      get width() {
        return canvas.width;
      },
      set width(v: number) {
        canvas.width = v;
      },
      get height() {
        return canvas.height;
      },
      set height(v: number) {
        canvas.height = v;
      },
      getContext: () => ({
        fillStyle: "",
        fillRect: () => {},
        getImageData: () => ({
          data: [0, 0, 0, canvas.width * canvas.height <= maxArea ? 255 : 0],
        }),
      }),
    } as unknown as HTMLCanvasElement;
  });
}

afterEach(() => vi.restoreAllMocks());

describe("usableRasterScale", () => {
  const SHEET_18x24 = [5400, 7200] as const; // 38.9M px at 300 DPI
  const SHEET_24x36 = [7200, 10800] as const; // 77.8M px

  it("uses full print resolution on a browser that allows it", () => {
    stubCanvasLimit(300_000_000);
    expect(usableRasterScale(...SHEET_18x24)).toBe(1);
    expect(usableRasterScale(...SHEET_24x36)).toBe(1);
  });

  it("steps down to fit a Safari-sized canvas cap rather than silently failing", () => {
    // Safari caps total canvas area at ~16.7M px — well under a print sheet, and
    // the reason a PNG export could produce nothing at all there.
    stubCanvasLimit(16_777_216);
    const scale = usableRasterScale(...SHEET_18x24);
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThan(1);
    // Whatever it picks has to actually fit.
    expect(5400 * scale * (7200 * scale)).toBeLessThanOrEqual(16_777_216);
  });

  it("gives a bigger sheet a smaller scale, since it has further to come down", () => {
    stubCanvasLimit(16_777_216);
    expect(usableRasterScale(...SHEET_24x36)).toBeLessThan(usableRasterScale(...SHEET_18x24));
  });

  it("reports failure rather than returning an unusable scale", () => {
    stubCanvasLimit(1000);
    expect(usableRasterScale(...SHEET_18x24)).toBe(0);
  });

  it("leaves a small sheet at full size", () => {
    stubCanvasLimit(16_777_216);
    expect(usableRasterScale(800, 600)).toBe(1);
  });
});
