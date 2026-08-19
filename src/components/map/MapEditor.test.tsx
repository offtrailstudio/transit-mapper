import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { primaryStopIds } from "../../lib/lines";

// react-map-gl needs a WebGL context jsdom doesn't have. The mock keeps the
// pieces this test actually cares about — that a click on open map reaches
// MapEditor's handler — and stubs the rest.
const mapClickHandlers: ((e: unknown) => void)[] = [];

vi.mock("react-map-gl/mapbox", () => ({
  default: ({ children, onClick, cursor }: { children: ReactNode; onClick: (e: unknown) => void; cursor: string }) => {
    mapClickHandlers[0] = onClick;
    return (
      <div data-testid="map" data-cursor={cursor}>
        {children}
      </div>
    );
  },
  MapProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
  Marker: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Popup: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useMap: () => ({ "main-map": { flyTo: vi.fn() } }),
}));

const { EditorConfigProvider } = await import("../../context/ConfigContext");
const { MapDataProvider, useMapData } = await import("../../context/MapDataContext");
const { PinModeProvider, usePinMode } = await import("../../context/PinModeContext");
const { SimModeProvider } = await import("../../context/SimModeContext");
const { MapEditor } = await import("./MapEditor");

/** Invokes the handler the mocked Map captured. act() so the resulting state lands before assertions. */
function clickMap() {
  act(() => {
    mapClickHandlers[0]?.({ lngLat: { lng: -73.98, lat: 40.75 } });
  });
}

/** Surfaces reducer state and pin controls so a test can assert without a UI for them. */
function Harness() {
  const { state, dispatch } = useMapData();
  const { startPinMode } = usePinMode();
  const routeId = state.data.routes[0]?.id;

  return (
    <div>
      <span data-testid="points">{state.data.stops.length}</span>
      <span data-testid="stops">{state.data.routes[0] ? primaryStopIds(state.data.routes[0]).length : 0}</span>
      <button onClick={() => dispatch({ type: "ADD_ROUTE" })}>add line</button>
      <button disabled={!routeId} onClick={() => routeId && startPinMode(routeId)}>
        start pin
      </button>
      <MapEditor />
    </div>
  );
}

function renderEditor() {
  return render(
    <EditorConfigProvider config={{ mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN }}>
      <MapDataProvider>
        <PinModeProvider>
          <SimModeProvider>
            <Harness />
          </SimModeProvider>
        </PinModeProvider>
      </MapDataProvider>
    </EditorConfigProvider>
  );
}

describe("MapEditor click handling", () => {
  it("ignores map clicks when pin mode is off", async () => {
    renderEditor();
    await userEvent.click(screen.getByText("add line"));

    clickMap();
    clickMap();

    expect(screen.getByTestId("points")).toHaveTextContent("0");
    expect(screen.getByTestId("stops")).toHaveTextContent("0");
  });

  it("adds a stop to the targeted line on the first click in pin mode", async () => {
    renderEditor();
    await userEvent.click(screen.getByText("add line"));
    await userEvent.click(screen.getByText("start pin"));

    clickMap();

    expect(screen.getByTestId("points")).toHaveTextContent("1");
    expect(screen.getByTestId("stops")).toHaveTextContent("1");
  });

  it("consumes exactly one click, so pin mode does not stay armed", async () => {
    renderEditor();
    await userEvent.click(screen.getByText("add line"));
    await userEvent.click(screen.getByText("start pin"));

    clickMap();
    clickMap();
    clickMap();

    expect(screen.getByTestId("points")).toHaveTextContent("1");
  });

  it("stops listening once pin mode is cancelled with Escape", async () => {
    renderEditor();
    await userEvent.click(screen.getByText("add line"));
    await userEvent.click(screen.getByText("start pin"));

    await userEvent.keyboard("{Escape}");
    clickMap();

    expect(screen.getByTestId("points")).toHaveTextContent("0");
  });

  it("shows the placing banner only while pin mode is active", async () => {
    renderEditor();
    await userEvent.click(screen.getByText("add line"));
    expect(screen.queryByText(/Click the map to place a stop/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("start pin"));
    expect(screen.getByText(/Click the map to place a stop/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(screen.queryByText(/Click the map to place a stop/)).not.toBeInTheDocument();
  });

  it("only offers the crosshair cursor while a stop is being placed", async () => {
    renderEditor();
    await userEvent.click(screen.getByText("add line"));
    expect(screen.getByTestId("map")).toHaveAttribute("data-cursor", "grab");

    await userEvent.click(screen.getByText("start pin"));
    expect(screen.getByTestId("map")).toHaveAttribute("data-cursor", "crosshair");
  });
});
