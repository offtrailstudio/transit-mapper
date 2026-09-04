import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { EditorConfigProvider } = await import("../../context/ConfigContext");
const { MapDataProvider, useMapData } = await import("../../context/MapDataContext");
const { PrintModeProvider, usePrintMode } = await import("../../context/PrintModeContext");
const { PrintSheetProvider } = await import("../../hooks/usePrintSheet");
const { SelectedStopControls } = await import("./SelectedStopControls");

const DATA = {
  version: 3 as const,
  title: "Test",
  stops: [
    { id: "p1", name: "Alpha", lng: -74.1, lat: 40.7 },
    { id: "p2", name: "Beta", lng: -74.0, lat: 40.8 },
  ],
  routes: [
    { id: "r", name: "Red", routeColor: "#ee352e", patterns: [{ id: "rp", stopIds: ["p1", "p2"] }] },
  ],
};

/** Loads the map, opens print mode, selects a stop, and reports the overrides. */
function Harness() {
  const { dispatch, state } = useMapData();
  const { isPrinting, open, selectStop, selectedStopId } = usePrintMode();
  return (
    <>
      {!isPrinting && (
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "LOAD", data: DATA });
            open();
          }}
        >
          begin
        </button>
      )}
      {!selectedStopId && (
        <button type="button" onClick={() => selectStop("p1")}>
          select p1
        </button>
      )}
      <output data-testid="overrides">{JSON.stringify(state.data.labelOverrides ?? {})}</output>
    </>
  );
}

async function setup() {
  render(
    <EditorConfigProvider config={{ mapboxToken: "t" }}>
      <MapDataProvider>
        <PrintModeProvider>
          <PrintSheetProvider>
            <Harness />
            <SelectedStopControls />
          </PrintSheetProvider>
        </PrintModeProvider>
      </MapDataProvider>
    </EditorConfigProvider>
  );
  await userEvent.click(screen.getByRole("button", { name: "begin" }));
  await userEvent.click(screen.getByRole("button", { name: "select p1" }));
  return () => JSON.parse(screen.getByTestId("overrides").textContent!);
}

describe("SelectedStopControls", () => {
  it("prompts for a selection when there is none", () => {
    render(
      <EditorConfigProvider config={{ mapboxToken: "t" }}>
        <MapDataProvider>
          <PrintModeProvider>
            <PrintSheetProvider>
              <SelectedStopControls />
            </PrintSheetProvider>
          </PrintModeProvider>
        </MapDataProvider>
      </EditorConfigProvider>
    );
    expect(screen.getByText(/click a stop on the sheet/i)).toBeInTheDocument();
  });

  it("names the selected stop", async () => {
    await setup();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("steps the label round the stop by 45° a click", async () => {
    const overrides = await setup();
    await userEvent.click(screen.getByRole("button", { name: /rotate label clockwise/i }));
    const first = overrides().p1.angle;

    await userEvent.click(screen.getByRole("button", { name: /rotate label clockwise/i }));
    expect(overrides().p1.angle).toBe((first + 45) % 360);
  });

  it("rotates the other way too, wrapping rather than going negative", async () => {
    const overrides = await setup();
    await userEvent.click(screen.getByRole("button", { name: /rotate label anticlockwise/i }));
    expect(overrides().p1.angle).toBeGreaterThanOrEqual(0);
    expect(overrides().p1.angle).toBeLessThan(360);
  });

  it("hides and shows the label", async () => {
    const overrides = await setup();
    await userEvent.click(screen.getByRole("button", { name: /hide label/i }));
    expect(overrides().p1.hidden).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /show label/i }));
    // Back to no override at all, rather than an entry saying "not hidden".
    expect(overrides().p1).toBeUndefined();
  });

  it("won't rotate a hidden label, which would change nothing visible", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: /hide label/i }));
    expect(screen.getByRole("button", { name: /rotate label clockwise/i })).toBeDisabled();
  });

  it("resets a hand-placed label back to automatic", async () => {
    const overrides = await setup();
    await userEvent.click(screen.getByRole("button", { name: /rotate label clockwise/i }));
    expect(overrides().p1).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /reset label to automatic/i }));
    expect(overrides().p1).toBeUndefined();
  });

  it("offers no reset until there is something to reset", async () => {
    await setup();
    expect(screen.queryByRole("button", { name: /reset label to automatic/i })).not.toBeInTheDocument();
  });
});
