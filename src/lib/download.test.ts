import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./download";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  // jsdom keeps one document across a file, and these links are deliberately
  // left in it until a timer fires — so clear them or they accumulate.
  document.body.replaceChildren();
});

describe("downloadBlob", () => {
  it("puts the link in the document before clicking it", () => {
    // A detached anchor is ignored outright by Firefox, so the download simply
    // never happens.
    let inDomAtClick: boolean | null = null;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        inDomAtClick = document.body.contains(this);
      });

    downloadBlob(new Blob(["<svg />"], { type: "image/svg+xml" }), "map.svg");

    expect(click).toHaveBeenCalledOnce();
    expect(inDomAtClick).toBe(true);
  });

  it("names the file", () => {
    let filename: string | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
    });

    downloadBlob(new Blob(["x"]), "transit-map-18x24.png");
    expect(filename).toBe("transit-map-18x24.png");
  });

  it("does not revoke the object URL before the browser has read the blob", () => {
    // Revoking on the line after click() is a race: the download may not have
    // started yet, and it silently produces nothing.
    vi.useFakeTimers();
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(new Blob(["x"]), "map.png");
    expect(revoke).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledOnce();
  });

  it("cleans the link back out of the document once the download has had its chance", () => {
    vi.useFakeTimers();
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(new Blob(["x"]), "map.png");
    expect(document.querySelectorAll("a[download]")).toHaveLength(1);

    vi.runAllTimers();
    expect(document.querySelectorAll("a[download]")).toHaveLength(0);
  });
});
