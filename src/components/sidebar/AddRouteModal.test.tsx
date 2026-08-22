import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorConfigProvider, type EditorConfig } from "../../context/ConfigContext";
import { MapDataProvider, useMapData } from "../../context/MapDataContext";
import { staticRouteSource, type RouteCatalog, type RouteSource } from "../../lib/presets";
import { AddRouteModal } from "./AddRouteModal";

const CATALOG: RouteCatalog = {
  schemaVersion: 2,
  groups: [
    { id: "amtrak", name: "Amtrak", defaultRouteType: "rail" },
    { id: "bart", name: "BART", defaultRouteType: "subway" },
  ],
  stops: [
    { id: "s1", name: "A", lng: -73, lat: 41 },
    { id: "s2", name: "B", lng: -74, lat: 42 },
  ],
  routes: [
    { id: "acela", name: "Acela", groupId: "amtrak", routeType: "hsr", patterns: [{ id: "p", stopIds: ["s1", "s2"] }] },
    { id: "red", name: "Richmond Line", groupId: "bart", patterns: [{ id: "p", stopIds: ["s1", "s2"] }] },
  ],
};

function Harness() {
  const { state } = useMapData();
  return (
    <div>
      <span data-testid="routes">
        {state.data.routes.map((r) => `${r.name}:${r.routeType}`).join("|")}
      </span>
      <AddRouteModal open onClose={() => {}} />
    </div>
  );
}

function setup(config: EditorConfig = {}, source?: RouteSource) {
  render(
    <EditorConfigProvider config={config}>
      <MapDataProvider routeSource={source ?? staticRouteSource(CATALOG)}>
        <Harness />
      </MapDataProvider>
    </EditorConfigProvider>
  );
}

describe("AddRouteModal", () => {
  it("lists routes from the source and adds one with its resolved mode", async () => {
    setup();
    // Empty query shows the whole source.
    expect(await screen.findByRole("button", { name: /Acela/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Richmond Line/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Acela/ }));
    expect(screen.getByTestId("routes")).toHaveTextContent("Acela:hsr");
  });

  it("filters results by the search query", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/Search routes/), "richmond");

    // Debounced: wait for the filtered result to replace the initial list.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Acela/ })).not.toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /Richmond Line/ })).toBeInTheDocument();
  });

  it("honors the routeNetworks allowlist", async () => {
    setup({ routeNetworks: ["amtrak"] });
    expect(await screen.findByRole("button", { name: /Acela/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Richmond Line/ })).not.toBeInTheDocument();
  });

  it("surfaces an error from the source", async () => {
    const failing: RouteSource = {
      search: async () => {
        throw new Error("source is down");
      },
      resolve: async () => {
        throw new Error("unused");
      },
    };
    setup({}, failing);
    expect(await screen.findByText(/source is down/)).toBeInTheDocument();
  });
});
