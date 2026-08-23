import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimModeProvider, useSimMode } from "./SimModeContext";

/**
 * Playback rules that aren't visible in any single component: how the editor
 * opens, how Esc peels off a focused mode, when map editing steps aside, and
 * when a follow run is allowed to throw away the clock.
 */
function Harness() {
  const {
    viewMode,
    playing,
    editingLocked,
    simSecondsRef,
    togglePlay,
    setViewMode,
    setFocusRoute,
    reset,
    subscribeFrame,
  } = useSimMode();
  // Winding the clock mutates a ref, which wouldn't repaint the readout below.
  const [, forceRender] = useState(0);
  // Stands in for the vehicle layer: paused, its only way to hear about a moved
  // clock is an out-of-band publish.
  const [frames, setFrames] = useState(0);
  useEffect(() => subscribeFrame(() => setFrames((n) => n + 1)), [subscribeFrame]);
  return (
    <div>
      <button onClick={togglePlay}>toggle play</button>
      <button onClick={reset}>reset</button>
      <button onClick={() => setViewMode("follow")}>follow</button>
      <button onClick={() => setViewMode("network")}>network</button>
      <button onClick={() => setFocusRoute("a")}>focus a</button>
      <button onClick={() => setFocusRoute("b")}>focus b</button>
      <button
        onClick={() => {
          simSecondsRef.current = 500;
          forceRender((n) => n + 1);
        }}
      >
        wind clock
      </button>
      {/* Repaints the readout below. The clock lives in a ref, and a reset back
          to a value React already holds bails out of re-rendering on its own. */}
      <button onClick={() => forceRender((n) => n + 1)}>read clock</button>
      <p>playing: {String(playing)}</p>
      <p>locked: {String(editingLocked)}</p>
      <p>mode: {viewMode}</p>
      <p>clock: {simSecondsRef.current}</p>
      <p>frames: {frames}</p>
    </div>
  );
}

function setup() {
  render(
    <SimModeProvider>
      <Harness />
    </SimModeProvider>
  );
}

describe("SimModeProvider", () => {
  it("opens paused on the network view, with the map still editable", () => {
    // The simulation is always mounted; pausing is what hands the map back.
    setup();

    expect(screen.getByText("playing: false")).toBeInTheDocument();
    expect(screen.getByText("mode: network")).toBeInTheDocument();
    expect(screen.getByText("locked: false")).toBeInTheDocument();
  });

  it("takes the map over while playing, and while a focused mode is showing", async () => {
    setup();
    await userEvent.click(screen.getByText("toggle play"));
    expect(screen.getByText("locked: true")).toBeInTheDocument();

    await userEvent.click(screen.getByText("toggle play"));
    await userEvent.click(screen.getByText("follow"));
    expect(screen.getByText("locked: true")).toBeInTheDocument();
  });

  it("Esc leaves a focused mode for the network, and does nothing there", async () => {
    setup();
    await userEvent.click(screen.getByText("focus a"));
    await userEvent.click(screen.getByText("follow"));

    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("mode: network")).toBeInTheDocument();

    // Nothing left to peel off: the simulation has no off state to fall into.
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("mode: network")).toBeInTheDocument();
  });

  it("repaints subscribers when the clock moves while paused", async () => {
    // No rAF loop runs while paused, so a reset has to push the new time out
    // itself — otherwise the vehicles sit at the old one until you press play.
    setup();
    await userEvent.click(screen.getByText("wind clock"));
    expect(screen.getByText("frames: 0")).toBeInTheDocument();

    await userEvent.click(screen.getByText("reset"));

    expect(screen.getByText("frames: 1")).toBeInTheDocument();
    expect(screen.getByText("clock: 0")).toBeInTheDocument();
  });

  it("restarts the clock when the followed route changes", async () => {
    setup();
    await userEvent.click(screen.getByText("focus a"));
    await userEvent.click(screen.getByText("follow"));
    await userEvent.click(screen.getByText("wind clock"));

    await userEvent.click(screen.getByText("focus b"));
    await userEvent.click(screen.getByText("read clock"));

    expect(screen.getByText("clock: 0")).toBeInTheDocument();
  });

  it("keeps the clock when stepping out to the network and back", async () => {
    // Glancing at the whole network mid-run and returning must not throw away
    // your place — only a change of subject restarts the trip.
    setup();
    await userEvent.click(screen.getByText("focus a"));
    await userEvent.click(screen.getByText("follow"));
    await userEvent.click(screen.getByText("wind clock"));

    await userEvent.click(screen.getByText("network"));
    await userEvent.click(screen.getByText("follow"));
    await userEvent.click(screen.getByText("read clock"));

    expect(screen.getByText("clock: 500")).toBeInTheDocument();
  });
});
