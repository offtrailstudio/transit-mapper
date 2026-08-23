import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimModeProvider, useSimMode } from "./SimModeContext";

/**
 * Playback rules that aren't visible in any single component: how Esc peels off
 * modes, and when a follow run is allowed to throw away the clock.
 */
function Harness() {
  const { active, viewMode, playing, simSecondsRef, enter, togglePlay, setViewMode, setFocusRoute } =
    useSimMode();
  // Winding the clock mutates a ref, which wouldn't repaint the readout below.
  const [, forceRender] = useState(0);
  return (
    <div>
      <button
        onClick={() => {
          enter();
          if (playing) {
            togglePlay();
          }
        }}
      >
        enter paused
      </button>
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
      <p>active: {String(active)}</p>
      <p>mode: {viewMode}</p>
      <p>clock: {simSecondsRef.current}</p>
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
  it("Esc leaves a focused mode for the network before leaving the simulation", async () => {
    setup();
    await userEvent.click(screen.getByText("enter paused"));
    await userEvent.click(screen.getByText("focus a"));
    await userEvent.click(screen.getByText("follow"));

    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("mode: network")).toBeInTheDocument();
    expect(screen.getByText("active: true")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("active: false")).toBeInTheDocument();
  });

  it("restarts the clock when the followed route changes", async () => {
    setup();
    await userEvent.click(screen.getByText("enter paused"));
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
    await userEvent.click(screen.getByText("enter paused"));
    await userEvent.click(screen.getByText("focus a"));
    await userEvent.click(screen.getByText("follow"));
    await userEvent.click(screen.getByText("wind clock"));

    await userEvent.click(screen.getByText("network"));
    await userEvent.click(screen.getByText("follow"));
    await userEvent.click(screen.getByText("read clock"));

    expect(screen.getByText("clock: 500")).toBeInTheDocument();
  });
});
