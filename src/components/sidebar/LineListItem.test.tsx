import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SharedMapProvider } from "../../context/MapDataContext";
import { SimModeProvider, SimViewMode, useSimMode } from "../../context/SimModeContext";
import { TransitMapData } from "../../lib/types";
import { RouteListItem } from "./LineListItem";

const ROUTE_A = {
  id: "a",
  name: "A Line",
  routeColor: "#f00",
  patterns: [{ id: "ap", stopIds: ["s1", "s2"] }],
};

const DATA: TransitMapData = {
  version: 3,
  title: "Test",
  stops: [
    { id: "s1", name: "One", lng: 0, lat: 0 },
    { id: "s2", name: "Two", lng: 0.05, lat: 0 },
  ],
  routes: [
    ROUTE_A,
    { id: "c", name: "C Line", routeColor: "#0f0", patterns: [{ id: "cp", stopIds: ["s1", "s2"] }] },
  ],
};

function Harness({ data }: { data: TransitMapData }) {
  const { enter, setViewMode, setFocusRoute } = useSimMode();
  const go = (mode: SimViewMode) => () => {
    enter();
    setFocusRoute("a");
    setViewMode(mode);
  };
  return (
    <div>
      <button onClick={go("follow")}>follow a</button>
      <button onClick={go("timetable")}>tabulate a</button>
      <ul>
        {data.routes.map((route) => (
          <RouteListItem key={route.id} route={route} />
        ))}
      </ul>
    </div>
  );
}

function renderList(data: TransitMapData = DATA) {
  render(
    <SharedMapProvider id="m1" data={data}>
      <SimModeProvider>
        <Harness data={data} />
      </SimModeProvider>
    </SharedMapProvider>
  );
}

const watching = () => screen.queryAllByText("Showing in the simulation");

describe("RouteListItem", () => {
  it("marks nothing while the simulation is closed", () => {
    renderList();
    expect(watching()).toHaveLength(0);
  });

  it("marks exactly the route a focused mode is showing", async () => {
    renderList();
    await userEvent.click(screen.getByText("follow a"));

    // One marker, and it belongs to the focused route's row.
    expect(watching()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /A Line/ })).toContainElement(watching()[0]);
  });

  it("marks the focused route in timetable mode too", async () => {
    renderList();
    await userEvent.click(screen.getByText("tabulate a"));

    expect(watching()).toHaveLength(1);
  });

  it("marks nothing on the whole-network view", async () => {
    renderList();
    await userEvent.click(screen.getByText("follow a"));
    expect(watching()).toHaveLength(1);

    await userEvent.keyboard("{Escape}");
    expect(watching()).toHaveLength(0);
  });

  it("never marks a hidden route, which the simulation can't run", async () => {
    renderList({ ...DATA, routes: [{ ...ROUTE_A, hidden: true }, DATA.routes[1]] });
    await userEvent.click(screen.getByText("follow a"));

    expect(watching()).toHaveLength(0);
  });
});
