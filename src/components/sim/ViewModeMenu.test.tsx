import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SharedMapProvider } from "../../context/MapDataContext";
import { SimModeProvider, useSimMode } from "../../context/SimModeContext";
import { TransitMapData } from "../../lib/types";
import { ViewModeMenu } from "./ViewModeMenu";

const DATA: TransitMapData = {
  version: 3,
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
  const { viewMode, focusRouteId } = useSimMode();
  return (
    <div>
      <ViewModeMenu />
      <p>mode: {viewMode}</p>
      <p>focus: {focusRouteId ?? "none"}</p>
    </div>
  );
}

function renderMenu(data: TransitMapData = DATA) {
  render(
    <SharedMapProvider id="m1" data={data}>
      <SimModeProvider>
        <Harness />
      </SimModeProvider>
    </SharedMapProvider>
  );
}

const openMenu = () => userEvent.click(screen.getByRole("button", { name: "Simulation view" }));

describe("ViewModeMenu", () => {
  it("starts on the whole network with the menu closed", () => {
    renderMenu();

    expect(screen.getByText("mode: network")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("names the current mode on the button, so the way out is visible", async () => {
    renderMenu();
    expect(screen.getByRole("button", { name: "Simulation view" })).toHaveAttribute(
      "title",
      "View: Network"
    );

    await openMenu();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Follow" }));

    expect(screen.getByRole("button", { name: "Simulation view" })).toHaveAttribute(
      "title",
      "View: Follow"
    );
  });

  it("switches to follow and commits a concrete route", async () => {
    renderMenu();
    await openMenu();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Follow" }));

    expect(screen.getByText("mode: follow")).toBeInTheDocument();
    // Entering a focused mode pins down the route that was only implied, so the
    // follow clock can tell a new subject from a re-entry.
    expect(screen.getByText("focus: a")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("returns to the network from the same control that entered", async () => {
    renderMenu();
    await openMenu();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Follow" }));
    await openMenu();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Network" }));

    expect(screen.getByText("mode: network")).toBeInTheDocument();
  });

  it("carries the route from timetable straight into follow", async () => {
    renderMenu();
    await openMenu();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Timetable" }));
    await openMenu();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Follow" }));

    expect(screen.getByText("mode: follow")).toBeInTheDocument();
    expect(screen.getByText("focus: a")).toBeInTheDocument();
  });

  it("disables the focused modes when there is no route to focus", async () => {
    renderMenu({ ...DATA, routes: [] });
    await openMenu();

    expect(screen.getByRole("menuitemradio", { name: "Follow" })).toBeDisabled();
    expect(screen.getByRole("menuitemradio", { name: "Timetable" })).toBeDisabled();
    expect(screen.getByRole("menuitemradio", { name: "Network" })).toBeEnabled();
  });
});
