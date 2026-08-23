import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// SimSettingsModal is a whole form over the map data; stub it so this test stays
// about the control bar itself (it has its own test file).
vi.mock("./SimSettingsModal", () => ({
  SimSettingsModal: () => null,
}));

const { SharedMapProvider } = await import("../../context/MapDataContext");
const { SimModeProvider, useSimMode } = await import("../../context/SimModeContext");
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

function Harness() {
  const { enter } = useSimMode();
  return (
    <div>
      <button onClick={enter}>enter</button>
      <SimControls />
    </div>
  );
}

function renderControls() {
  return render(
    <SharedMapProvider id="m1" data={DATA}>
      <SimModeProvider>
        <Harness />
      </SimModeProvider>
    </SharedMapProvider>
  );
}

describe("SimControls", () => {
  it("renders nothing until simulation mode is entered", () => {
    renderControls();
    expect(screen.queryByLabelText("Pause")).not.toBeInTheDocument();
  });

  it("shows the clock and current speed once active", async () => {
    renderControls();
    await userEvent.click(screen.getByText("enter"));

    expect(screen.getByLabelText("Simulated time")).toHaveTextContent(/^\d{2}:\d{2}$/);
    expect(screen.getByLabelText("Pause")).toBeInTheDocument();
    // Opens at the fastest step: real time is too slow to read a network by.
    expect(screen.getByRole("button", { name: /playback speed/i })).toHaveTextContent("60×");
  });

  it("selects a different multiplier from the speed menu", async () => {
    renderControls();
    await userEvent.click(screen.getByText("enter"));
    await userEvent.click(screen.getByRole("button", { name: /playback speed/i }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "10×" }));

    expect(screen.getByRole("button", { name: /playback speed/i })).toHaveTextContent("10×");
  });

  it("always shows the settings gear once active", async () => {
    renderControls();
    await userEvent.click(screen.getByText("enter"));

    expect(screen.getByLabelText("Simulation settings")).toBeInTheDocument();
  });

  it("toggles play and pause", async () => {
    renderControls();
    await userEvent.click(screen.getByText("enter"));
    await userEvent.click(screen.getByLabelText("Pause"));

    expect(screen.getByLabelText("Play")).toBeInTheDocument();
  });

  it("carries the view menu but never the route picker", async () => {
    // The bar holds playback controls only; the route lives in the top-right of
    // whichever focused mode is showing, not down here.
    renderControls();
    await userEvent.click(screen.getByText("enter"));

    expect(screen.getByRole("button", { name: "Simulation view" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /simulated route/i })).not.toBeInTheDocument();
  });
});
