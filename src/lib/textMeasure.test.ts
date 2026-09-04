import { describe, expect, it, vi } from "vitest";
import { createTextMeasurer, estimateTextWidth, EXPORT_FONT_STACK } from "./textMeasure";

describe("estimateTextWidth", () => {
  it("grows with the length of the text", () => {
    const style = { fontSizePx: 88 };
    expect(estimateTextWidth("Wall St", style)).toBeLessThan(
      estimateTextWidth("Illinois Institute of Technology", style)
    );
  });

  it("grows with the font size", () => {
    expect(estimateTextWidth("Bank", { fontSizePx: 44 })).toBeLessThan(
      estimateTextWidth("Bank", { fontSizePx: 88 })
    );
  });

  it("adds letter-spacing once per character", () => {
    const plain = estimateTextWidth("Bank", { fontSizePx: 88 });
    const spaced = estimateTextWidth("Bank", { fontSizePx: 88, letterSpacingPx: 10 });
    expect(spaced - plain).toBeCloseTo(40);
  });

  it("never reports a zero width, so an empty name still gets a collision box", () => {
    expect(estimateTextWidth("", { fontSizePx: 88 })).toBeGreaterThan(0);
  });
});

describe("createTextMeasurer", () => {
  // jsdom leaves getContext("2d") unimplemented, so this exercises the fallback
  // path the measurer takes under SSR too — the one that must never return 0.
  it("falls back to the estimate when no canvas is available", () => {
    const measure = createTextMeasurer();
    const style = { fontSizePx: 88, fontWeight: 600 };
    expect(measure("Illinois Institute of Technology", style)).toBeGreaterThan(0);
    expect(measure("Wall St", style)).toBeLessThan(measure("Illinois Institute of Technology", style));
  });

  it("returns the same width for the same request", () => {
    const measure = createTextMeasurer();
    const style = { fontSizePx: 88, fontWeight: 600 };
    expect(measure("Union Square", style)).toBe(measure("Union Square", style));
  });

  it("names a concrete font stack for the canvas and the SVG to share", () => {
    expect(EXPORT_FONT_STACK).toContain("sans-serif");
  });
});

describe("createTextMeasurer with a working canvas", () => {
  function withStubCanvas<T>(measureText: (text: string) => { width: number }, run: (fonts: string[]) => T): T {
    const fonts: string[] = [];
    const context = {
      set font(value: string) {
        fonts.push(value);
      },
      measureText,
    };
    const original = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag !== "canvas") return original(tag as "div");
      return { getContext: () => context } as unknown as HTMLCanvasElement;
    });
    try {
      return run(fonts);
    } finally {
      spy.mockRestore();
    }
  }

  it("asks the canvas for the width, in the font the SVG will draw with", () => {
    withStubCanvas(
      (text) => ({ width: text.length * 7 }),
      (fonts) => {
        const measure = createTextMeasurer();
        expect(measure("Union", { fontSizePx: 88, fontWeight: 600 })).toBe(35);
        expect(fonts).toEqual([`600 88px ${EXPORT_FONT_STACK}`]);
      }
    );
  });

  it("adds letter-spacing on top of the measured width", () => {
    withStubCanvas(
      (text) => ({ width: text.length * 7 }),
      () => {
        const measure = createTextMeasurer();
        expect(measure("Union", { fontSizePx: 88, letterSpacingPx: 3 })).toBe(35 + 15);
      }
    );
  });

  it("measures each distinct request once and reuses it after", () => {
    let calls = 0;
    withStubCanvas(
      (text) => {
        calls++;
        return { width: text.length * 7 };
      },
      () => {
        const measure = createTextMeasurer();
        const style = { fontSizePx: 88, fontWeight: 600 };
        measure("Union", style);
        measure("Union", style);
        measure("Union", { fontSizePx: 44, fontWeight: 600 });
        expect(calls).toBe(2);
      }
    );
  });

  it("falls back to the estimate when the context reports a zero width", () => {
    // A stub context that shapes nothing would otherwise collapse every
    // collision box to a point, which is worse than no measurement at all.
    withStubCanvas(
      () => ({ width: 0 }),
      () => {
        const style = { fontSizePx: 88, fontWeight: 600 };
        expect(createTextMeasurer()("Union", style)).toBe(estimateTextWidth("Union", style));
      }
    );
  });
});
