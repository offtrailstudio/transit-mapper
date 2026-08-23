import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SharedMapProvider } from "../../context/MapDataContext";
import { SimModeProvider, SimViewMode, useSimMode } from "../../context/SimModeContext";
import { TransitMapData } from "../../lib/types";
import { FollowRoutePicker } from "./FollowRoutePicker";

const DATA: TransitMapData = {
  version: 3,
  title: "Test",
  stops: [
    { id: "s1", name: "One", lng: 0, lat: 0 },
    { id: "s2", name: "Two", lng: 0.05, lat: 0 },
  ],
  routes: [
    { id: "a", name: "A Line", routeColor: "#f00", patterns: [{ id: "ap", stopIds: ["s1", "s2"] }] },
    { id: "c", name: "C Line", routeColor: "#0f0", patterns: [{ id: "cp", stopIds: ["s1", "s2"] }] },
  ],
};

function Harness() {
  const { enter, setViewMode } = useSimMode();
  const go = (mode: SimViewMode) => () => {
    enter();
    setViewMode(mode);
  };
  return (
    <div>
      <button onClick={go("follow")}>follow</button>
      <button onClick={go("timetable")}>timetable</button>
      <button onClick={go("network")}>network</button>
      <FollowRoutePicker />
    </div>
  );
}

function renderPicker() {
  render(
    <SharedMapProvider id="m1" data={DATA}>
      <SimModeProvider>
        <Harness />
      </SimModeProvider>
    </SharedMapProvider>
  );
}

const picker = () => screen.queryByRole("button", { name: /simulated route/i });

describe("FollowRoutePicker", () => {
  it("stays out of the way until the simulation is following", () => {
    renderPicker();
    expect(picker()).not.toBeInTheDocument();
  });

  it("appears while following", async () => {
    renderPicker();
    await userEvent.click(screen.getByText("follow"));

    expect(picker()).toBeInTheDocument();
    expect(picker()).toHaveTextContent("A Line");
  });

  it("yields to the timetable, which mounts its own copy in its header", async () => {
    renderPicker();
    await userEvent.click(screen.getByText("follow"));
    await userEvent.click(screen.getByText("timetable"));

    expect(picker()).not.toBeInTheDocument();
  });

  it("goes away again on returning to the network", async () => {
    renderPicker();
    await userEvent.click(screen.getByText("follow"));
    await userEvent.click(screen.getByText("network"));

    expect(picker()).not.toBeInTheDocument();
  });

  it("switches the followed route", async () => {
    renderPicker();
    await userEvent.click(screen.getByText("follow"));
    await userEvent.click(picker()!);
    await userEvent.click(screen.getByRole("menuitemradio", { name: "C Line" }));

    expect(picker()).toHaveTextContent("C Line");
  });
});
