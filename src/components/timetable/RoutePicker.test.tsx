import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SharedMapProvider, useMapData } from "../../context/MapDataContext";
import { SimModeProvider, useSimMode } from "../../context/SimModeContext";
import { TransitMapData } from "../../lib/types";
import { RoutePicker } from "./RoutePicker";

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
  const { focusRouteId } = useSimMode();
  const { dispatch } = useMapData();
  return (
    <div>
      <RoutePicker />
      <button onClick={() => dispatch({ type: "SET_ACTIVE_ROUTE", routeId: "c" })}>expand C</button>
      <p>focus: {focusRouteId ?? "none"}</p>
    </div>
  );
}

function renderPicker(data: TransitMapData = DATA) {
  render(
    <SharedMapProvider id="m1" data={data}>
      <SimModeProvider>
        <Harness />
      </SimModeProvider>
    </SharedMapProvider>
  );
}

describe("RoutePicker", () => {
  it("falls back to the first route and starts closed", () => {
    renderPicker();

    expect(screen.getByRole("button", { name: /simulated route/i })).toHaveTextContent("A Line");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("follows the sidebar's active route before anything is picked", async () => {
    // Opening a focused mode should land on the route you were already editing,
    // not an arbitrary one.
    renderPicker();
    await userEvent.click(screen.getByText("expand C"));

    expect(screen.getByRole("button", { name: /simulated route/i })).toHaveTextContent("C Line");
  });

  it("picks a route into the shared focus and closes", async () => {
    renderPicker();
    await userEvent.click(screen.getByRole("button", { name: /simulated route/i }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "C Line" }));

    expect(screen.getByText("focus: c")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /simulated route/i })).toHaveTextContent("C Line");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders nothing when the map has no routes", () => {
    renderPicker({ ...DATA, routes: [] });

    expect(screen.queryByRole("button", { name: /simulated route/i })).not.toBeInTheDocument();
  });

  it("offers hidden routes as unavailable rather than dropping them", async () => {
    // A hidden route is out of the simulation, so it can't be followed or
    // tabulated — but removing it from the list would read as a deletion.
    renderPicker({
      ...DATA,
      routes: [DATA.routes[0], { ...DATA.routes[1], hidden: true }],
    });
    await userEvent.click(screen.getByRole("button", { name: /simulated route/i }));

    expect(screen.getByRole("menuitemradio", { name: /C Line/ })).toBeDisabled();
    expect(screen.getByRole("menuitemradio", { name: /A Line/ })).toBeEnabled();
  });
});
