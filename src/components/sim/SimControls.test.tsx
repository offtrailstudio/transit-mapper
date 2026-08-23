import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// SimSettingsModal is a whole form over the map data; stub it so this test stays
// about the control bar itself (it has its own test file).
vi.mock("./SimSettingsModal", () => ({
  SimSettingsModal: () => null,
}));

const { SharedMapProvider } = await import("../../context/MapDataContext");
const { SimModeProvider } = await import("../../context/SimModeContext");
const { SimControls } = await import("./SimControls");

const DATA = {
  version: 3 as const,
  title: "Test",
  stops: [
    { id: "s1", name: "One", lng: 0, lat: 0 },
    { id: "s2", name: "Two", lng: 0.05, lat: 0 },
  ],
  routes: [
    { id: "a", name: "A Line", routeColor: "#f00", patterns: [{ id: "ap", stopIds: ["s1", "s2"] }] },
  ],
};

function renderControls() {
  return render(
    <SharedMapProvider id="m1" data={DATA}>
      <SimModeProvider>
        <SimControls />
      </SimModeProvider>
    </SharedMapProvider>
  );
}

describe("SimControls", () => {
  it("is on screen from the start, paused", () => {
    // The simulation is always mounted, so its transport is too — the editor
    // opens with a clock sitting at rest rather than a mode you have to find.
    renderControls();

    expect(screen.getByLabelText("Play")).toBeInTheDocument();
    expect(screen.getByLabelText("Simulated time")).toHaveTextContent(/^\d{2}:\d{2}$/);
    // Opens at the fastest step: real time is too slow to read a network by.
    expect(screen.getByRole("button", { name: /playback speed/i })).toHaveTextContent("60×");
  });

  it("toggles play and pause", async () => {
    renderControls();
    await userEvent.click(screen.getByLabelText("Play"));

    expect(screen.getByLabelText("Pause")).toBeInTheDocument();
  });

  it("selects a different multiplier from the speed menu", async () => {
    renderControls();
    await userEvent.click(screen.getByRole("button", { name: /playback speed/i }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "10×" }));

    expect(screen.getByRole("button", { name: /playback speed/i })).toHaveTextContent("10×");
  });

  it("always shows the settings gear", () => {
    renderControls();

    expect(screen.getByLabelText("Simulation settings")).toBeInTheDocument();
  });

  it("holds playback controls only — no view modes, no route, no exit", async () => {
    // The bar is the clock's transport. Which view is showing lives in the map's
    // top-left (`ViewModeMenu`), the route in its top-right, and there is no
    // exit: the simulation is never off, only paused.
    renderControls();

    expect(screen.getByLabelText("Reset clock")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Simulation view" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /simulated route/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /exit/i })).not.toBeInTheDocument();
  });
});
