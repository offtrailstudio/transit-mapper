import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteEditor } from "../components/sidebar/LineEditor";
import type { TransitMapData } from "../lib/types";
import { SharedMapProvider, useMapData } from "./MapDataContext";

const DATA = {
  title: "Metro",
  stops: [
    { id: "s1", name: "Alpha", lng: 0, lat: 0 },
    { id: "s2", name: "Beta", lng: 1, lat: 1 },
  ],
  routes: [{ id: "r1", name: "Red", routeColor: "#ff0000", stopIds: ["s1", "s2"] }],
} as unknown as TransitMapData;

function Probe() {
  const { readOnly, state } = useMapData();
  return (
    <div>
      ro:{String(readOnly)}|title:{state.data.title}|routes:{state.data.routes.length}
    </div>
  );
}

function ExpandedRoute() {
  const { state } = useMapData();
  return <RouteEditor route={state.data.routes[0]} />;
}

describe("SharedMapProvider", () => {
  it("exposes the shared map as read-only, seeded from the given data", () => {
    render(
      <SharedMapProvider id="r1" data={DATA}>
        <Probe />
      </SharedMapProvider>
    );
    expect(screen.getByText("ro:true|title:Metro|routes:1")).toBeInTheDocument();
  });

  it("renders route stops without editing controls in read-only mode", () => {
    render(
      <SharedMapProvider id="r1" data={DATA}>
        <ExpandedRoute />
      </SharedMapProvider>
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    // No name/color inputs and no "Add stop" affordance when read-only.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Add stop")).not.toBeInTheDocument();
  });
});
