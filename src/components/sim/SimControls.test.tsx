import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// SimSettingsModal reaches into MapData; stub it so this test stays about controls.
vi.mock("./SimSettingsModal", () => ({
  SimSettingsModal: () => null,
}));

const { SimModeProvider, useSimMode } = await import("../../context/SimModeContext");
const { TimetableModeProvider } = await import("../../context/TimetableModeContext");
const { SimControls } = await import("./SimControls");

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
    <SimModeProvider>
      <TimetableModeProvider>
        <Harness />
      </TimetableModeProvider>
    </SimModeProvider>
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
    expect(screen.getByRole("button", { name: /playback speed/i })).toHaveTextContent("5×");
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
});
