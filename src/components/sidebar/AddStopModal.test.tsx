import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { primaryStopIds } from "../../lib/lines";

const flyTo = vi.fn();
vi.mock("react-map-gl/mapbox", () => ({
  useMap: () => ({ "main-map": { flyTo } }),
  MapProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { EditorConfigProvider } = await import("../../context/ConfigContext");
const { MapDataProvider, useMapData } = await import("../../context/MapDataContext");
const { PinModeProvider, usePinMode } = await import("../../context/PinModeContext");
const { AddStopModal } = await import("./AddStopModal");

const LINE_A = { id: "route-a", name: "Red", routeColor: "#ee352e", patterns: [{ id: "route-a-p", stopIds: [] as string[] }] };
const LINE_B = { id: "route-b", name: "Blue", routeColor: "#0039a6", patterns: [{ id: "route-b-p", stopIds: [] as string[] }] };
const DATA = {
  version: 3 as const,
  title: "Test",
  stops: [
    { id: "p1", name: "Alpha", lng: 1, lat: 2 },
    { id: "p2", name: "Beta", lng: 3, lat: 4 },
  ],
  routes: [LINE_A, LINE_B],
};

/** Loads a known map, then renders the modal against whichever route the test names. */
function Harness({ routeId }: { routeId: string }) {
  const { state, dispatch } = useMapData();
  const { pinRouteId } = usePinMode();
  const route = state.data.routes.find((l) => l.id === routeId);

  return (
    <div>
      <button onClick={() => dispatch({ type: "LOAD", data: DATA })}>load</button>
      <span data-testid="pin-target">{pinRouteId ?? "none"}</span>
      <span data-testid="route-a-stops">{state.data.routes[0] && primaryStopIds(state.data.routes[0]).join(",")}</span>
      <span data-testid="route-b-stops">{state.data.routes[1] && primaryStopIds(state.data.routes[1]).join(",")}</span>
      {route && <AddStopModal route={route} open onClose={() => {}} />}
    </div>
  );
}

async function setup(routeId: string) {
  render(
    <EditorConfigProvider config={{ mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN }}>
      <MapDataProvider>
        <PinModeProvider>
          <Harness routeId={routeId} />
        </PinModeProvider>
      </MapDataProvider>
    </EditorConfigProvider>
  );
  await userEvent.click(screen.getByText("load"));
}

describe("AddStopModal", () => {
  it("lists only stations that are not already stops on this route", async () => {
    await setup("route-a");
    await userEvent.click(screen.getByRole("button", { name: "Existing" }));

    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Alpha" }));
    await userEvent.click(screen.getByRole("button", { name: "Existing" }));
    expect(screen.queryByRole("button", { name: "Alpha" })).not.toBeInTheDocument();
  });

  it("adds an existing station to the route it was opened from, not another route", async () => {
    await setup("route-b");
    await userEvent.click(screen.getByRole("button", { name: "Existing" }));
    await userEvent.click(screen.getByRole("button", { name: "Beta" }));

    expect(screen.getByTestId("route-b-stops")).toHaveTextContent("p2");
    expect(screen.getByTestId("route-a-stops")).toBeEmptyDOMElement();
  });

  it("arms pin mode for its own route", async () => {
    await setup("route-b");
    await userEvent.click(screen.getByRole("button", { name: "Place pin" }));
    expect(screen.getByTestId("pin-target")).toHaveTextContent("none");

    await userEvent.click(screen.getByRole("button", { name: /Place a pin on the map/ }));
    expect(screen.getByTestId("pin-target")).toHaveTextContent("route-b");
  });

  it("says so rather than showing an empty list when every station is already a stop", async () => {
    await setup("route-a");
    await userEvent.click(screen.getByRole("button", { name: "Existing" }));
    await userEvent.click(screen.getByRole("button", { name: "Alpha" }));
    await userEvent.click(screen.getByRole("button", { name: "Existing" }));
    await userEvent.click(screen.getByRole("button", { name: "Beta" }));

    await userEvent.click(screen.getByRole("button", { name: "Existing" }));
    expect(screen.getByText(/already a stop on Red/)).toBeInTheDocument();
  });

  it("opens on the search tab", async () => {
    await setup("route-a");
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText(/Search for a place/)).toBeInTheDocument();
  });
});
