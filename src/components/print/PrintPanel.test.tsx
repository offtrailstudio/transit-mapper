import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { EditorConfigProvider } = await import("../../context/ConfigContext");
const { MapDataProvider, SharedMapProvider } = await import("../../context/MapDataContext");
const { PrintModeProvider, usePrintMode } = await import("../../context/PrintModeContext");
const { PrintSheetProvider } = await import("../../hooks/usePrintSheet");
const { PrintPanel } = await import("./PrintPanel");

const DATA = {
  version: 3 as const,
  title: "Test",
  stops: [
    { id: "p1", name: "Alpha", lng: 1, lat: 2 },
    { id: "p2", name: "Beta", lng: 1.2, lat: 2.2 },
  ],
  routes: [
    { id: "route-a", name: "Red", routeColor: "#ee352e", patterns: [{ id: "route-a-p", stopIds: ["p1", "p2"] }] },
  ],
};

/** Surfaces the live settings so a test can assert what the controls actually changed. */
function SettingsProbe() {
  const { settings } = usePrintMode();
  return <output data-testid="settings">{JSON.stringify(settings)}</output>;
}

function renderPanel({ token }: { token?: string } = { token: "test-token" }) {
  render(
    <EditorConfigProvider config={{ mapboxToken: token }}>
      <MapDataProvider>
        <SharedMapProvider id="route-a" data={DATA}>
          <PrintModeProvider>
            <PrintSheetProvider>
              <PrintPanel />
              <SettingsProbe />
            </PrintSheetProvider>
          </PrintModeProvider>
        </SharedMapProvider>
      </MapDataProvider>
    </EditorConfigProvider>
  );
  return () => JSON.parse(screen.getByTestId("settings").textContent!);
}

describe("PrintPanel", () => {
  it("shows every sheet control", () => {
    renderPanel();
    for (const label of ["Style", "Background", "Paper size", "Stop label size", "File"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /download png/i })).toBeInTheDocument();
  });

  it("switches layout style", async () => {
    const settings = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "schematic" }));
    expect(settings().mode).toBe("schematic");
  });

  it("drops a basemap when leaving geographic, where it cannot align", async () => {
    const settings = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "map" }));
    expect(settings().background).toBe("light");

    await userEvent.click(screen.getByRole("button", { name: "schematic" }));
    expect(settings().background).toBe("plain");
  });

  it("disables the basemap options without a Mapbox token", () => {
    renderPanel({ token: undefined });
    expect(screen.getByRole("button", { name: "map" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "map (dark)" })).toBeDisabled();
  });

  it("changes the paper size", async () => {
    const settings = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "24 × 36" }));
    expect(settings().sizeId).toBe("24x36");
  });

  it("steps the stop label size and shows it as a percentage", async () => {
    const settings = renderPanel();
    const base = settings().labelFontSizePx;

    await userEvent.click(screen.getByRole("button", { name: /larger stop labels/i }));
    expect(settings().labelFontSizePx).toBeGreaterThan(base);
    expect(screen.getByText("110%")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /smaller stop labels/i }));
    expect(settings().labelFontSizePx).toBe(base);
  });

  it("stops the label size at its bounds rather than running away", async () => {
    const settings = renderPanel();
    const larger = screen.getByRole("button", { name: /larger stop labels/i });
    for (let i = 0; i < 20; i++) {
      if (!(larger as HTMLButtonElement).disabled) await userEvent.click(larger);
    }
    expect(settings().labelFontSizePx).toBeLessThanOrEqual(88 * 1.8);
    expect(larger).toBeDisabled();
  });

  it("names the file format on the download button so it's clear what you get", async () => {
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "svg" }));
    expect(screen.getByRole("button", { name: /download svg/i })).toBeInTheDocument();
  });

  it("offers a way back to editing", async () => {
    render(
      <EditorConfigProvider config={{ mapboxToken: "t" }}>
        <MapDataProvider>
          <SharedMapProvider id="route-a" data={DATA}>
            <PrintModeProvider>
              <PrintSheetProvider>
                <PrintPanel />
                <PrintingProbe />
              </PrintSheetProvider>
            </PrintModeProvider>
          </SharedMapProvider>
        </MapDataProvider>
      </EditorConfigProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: /back to editing/i }));
    expect(screen.getByTestId("printing").textContent).toBe("false");
  });
});

function PrintingProbe() {
  const { isPrinting } = usePrintMode();
  return <output data-testid="printing">{String(isPrinting)}</output>;
}
