import { describe, expect, it } from "vitest";
import { LINE_COLOR_PALETTE, nextRouteColor } from "./colors";

describe("nextRouteColor", () => {
  it("returns the palette color at the given index", () => {
    expect(nextRouteColor(0)).toBe(LINE_COLOR_PALETTE[0]);
    expect(nextRouteColor(1)).toBe(LINE_COLOR_PALETTE[1]);
  });

  it("wraps around once the count exceeds the palette length", () => {
    expect(nextRouteColor(LINE_COLOR_PALETTE.length)).toBe(LINE_COLOR_PALETTE[0]);
    expect(nextRouteColor(LINE_COLOR_PALETTE.length + 2)).toBe(LINE_COLOR_PALETTE[2]);
  });
});
