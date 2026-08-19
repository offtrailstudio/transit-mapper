import { describe, expect, it } from "vitest";
import { basemapImageSize, basemapStaticUrl } from "./basemap";
import type { GeoBounds } from "./exportGeometry";

const BOUNDS: GeoBounds = { minLng: -74.05, minLat: 40.6, maxLng: -73.75, maxLat: 40.9 };

describe("basemapImageSize", () => {
  it("caps the long side at 1280 and preserves the sheet's aspect ratio", () => {
    const { width, height } = basemapImageSize(5400, 7200);
    expect(Math.max(width, height)).toBe(1280);
    // 3:4 portrait in, 3:4 out.
    expect(width / height).toBeCloseTo(5400 / 7200, 5);
  });

  it("caps the width when the sheet is landscape", () => {
    const { width, height } = basemapImageSize(7200, 5400);
    expect(width).toBe(1280);
    expect(width).toBeGreaterThan(height);
  });
});

describe("basemapStaticUrl", () => {
  it("targets the Mapbox static bbox endpoint for the requested style", () => {
    const url = basemapStaticUrl(BOUNDS, {
      style: "light",
      widthPx: 5400,
      heightPx: 7200,
      token: "tok123",
    });
    expect(url).toContain("api.mapbox.com/styles/v1/mapbox/light-v11/static/");
    expect(url).toContain("[-74.050000,40.600000,-73.750000,40.900000]");
    expect(url).toContain("960x1280@2x");
    expect(url).toContain("access_token=tok123");
    expect(url).toContain("logo=false");
    expect(url).toContain("attribution=false");
  });

  it("maps the dark option to the dark Mapbox style", () => {
    const url = basemapStaticUrl(BOUNDS, {
      style: "dark",
      widthPx: 5400,
      heightPx: 7200,
      token: "t",
    });
    expect(url).toContain("/mapbox/dark-v11/static/");
  });
});
