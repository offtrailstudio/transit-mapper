import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { EditorConfigProvider } = await import("../../context/ConfigContext");
const { MapDataProvider, SharedMapProvider } = await import("../../context/MapDataContext");
const { PrintModeProvider, usePrintMode } = await import("../../context/PrintModeContext");
const { PrintSheetProvider } = await import("../../hooks/usePrintSheet");
const { PrintPreview } = await import("./PrintPreview");

const DATA = {
  version: 3 as const,
  title: "Test",
  stops: [
    { id: "p1", name: "Alpha", lng: -74.1, lat: 40.7 },
    { id: "p2", name: "Beta", lng: -74.0, lat: 40.8 },
    { id: "p3", name: "Gamma", lng: -73.9, lat: 40.9 },
  ],
  routes: [
    { id: "r", name: "Red", routeColor: "#ee352e", patterns: [{ id: "rp", stopIds: ["p1", "p2", "p3"] }] },
  ],
};

/** Opens print mode on mount and reports what's selected. */
function Harness() {
  const { isPrinting, open, selectedStopId, update } = usePrintMode();
  return (
    <>
      {!isPrinting && (
        <button type="button" onClick={open}>
          open print
        </button>
      )}
      {/* Rebuilds the sheet's SVG from scratch, as changing the background does. */}
      <button type="button" onClick={() => update({ sizeId: "24x36" })}>
        resize sheet
      </button>
      <output data-testid="selected">{selectedStopId ?? "none"}</output>
    </>
  );
}

async function renderPreview() {
  render(
    <EditorConfigProvider config={{ mapboxToken: "test-token" }}>
      <MapDataProvider>
        <SharedMapProvider id="r" data={DATA}>
          <PrintModeProvider>
            <PrintSheetProvider>
              <Harness />
              <PrintPreview />
            </PrintSheetProvider>
          </PrintModeProvider>
        </SharedMapProvider>
      </MapDataProvider>
    </EditorConfigProvider>
  );
  await userEvent.click(screen.getByRole("button", { name: "open print" }));
}

/** The click targets live in the overlay, which is the SVG that isn't the sheet. */
function hitTargets(): SVGCircleElement[] {
  return Array.from(document.querySelectorAll<SVGCircleElement>('circle[fill="transparent"]'));
}

describe("PrintPreview", () => {
  it("puts a click target on every stop", async () => {
    await renderPreview();
    expect(hitTargets()).toHaveLength(DATA.stops.length);
  });

  it("selects the stop that was clicked", async () => {
    await renderPreview();
    await userEvent.click(hitTargets()[0]);
    expect(screen.getByTestId("selected").textContent).not.toBe("none");
  });

  it("keeps its click targets when the sheet is rebuilt", async () => {
    // Regression: the targets used to be appended into the sheet's own SVG by an
    // effect. Any setting that rewrites that SVG replaces its innerHTML, which
    // destroys anything added to it — so selection worked in one background and
    // died on the way back to another.
    await renderPreview();
    expect(hitTargets()).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "resize sheet" }));
    expect(hitTargets()).toHaveLength(3);

    // And they still work afterwards.
    await userEvent.click(hitTargets()[1]);
    expect(screen.getByTestId("selected").textContent).not.toBe("none");
  });

  it("clears the selection when the sheet's background is clicked", async () => {
    await renderPreview();
    await userEvent.click(hitTargets()[0]);
    expect(screen.getByTestId("selected").textContent).not.toBe("none");

    const backdrop = document.querySelector(".overflow-auto")!;
    await userEvent.click(backdrop);
    expect(screen.getByTestId("selected").textContent).toBe("none");
  });

  it("names each target, so hovering a dot says which stop it is", async () => {
    await renderPreview();
    const names = hitTargets().map((c) => c.querySelector("title")?.textContent);
    expect(names).toEqual(["Alpha", "Beta", "Gamma"]);
  });
});
