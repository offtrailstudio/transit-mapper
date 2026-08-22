import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorConfigProvider, type EditorConfig } from "../../context/ConfigContext";
import { MapDataProvider, useMapData } from "../../context/MapDataContext";
import type { PresetCatalog, PresetSource } from "../../lib/presets";
import { PresetRoutesModal } from "./PresetLinesModal";

const CATALOG: PresetCatalog = {
  schemaVersion: 2,
  groups: [{ id: "mynet", name: "MyNet", defaultRouteType: "tram" }],
  stops: [
    { id: "s1", name: "A", lng: -73, lat: 41 },
    { id: "s2", name: "B", lng: -74, lat: 42 },
  ],
  routes: [
    {
      id: "r1",
      name: "My Route",
      groupId: "mynet",
      patterns: [{ id: "r1:p0", stopIds: ["s1", "s2"] }],
    },
  ],
};

function Harness() {
  const { state } = useMapData();
  return (
    <div>
      <span data-testid="routes">
        {state.data.routes.map((r) => `${r.name}:${r.routeType}`).join("|")}
      </span>
      <PresetRoutesModal open onClose={() => {}} />
    </div>
  );
}

function setup(config: EditorConfig = {}, presets?: PresetSource) {
  render(
    <EditorConfigProvider config={config}>
      <MapDataProvider presets={presets}>
        <Harness />
      </MapDataProvider>
    </EditorConfigProvider>
  );
}

describe("PresetRoutesModal", () => {
  it("collapses networks by default and expands one on click", async () => {
    setup();
    expect(screen.queryByRole("button", { name: /Acela/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Amtrak/ }));
    expect(screen.getByRole("button", { name: /Acela/ })).toBeInTheDocument();
  });

  it("searches across every network without needing to expand groups", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/Search networks/), "Acela");

    expect(screen.getByRole("button", { name: /Acela/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Northeast Regional/ })).not.toBeInTheDocument();
  });

  it("shows each route's resolved transit mode", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/Search networks/), "Acela");
    // Acela overrides its group's rail default to high-speed rail.
    expect(screen.getByRole("button", { name: /High-speed rail/ })).toBeInTheDocument();
  });

  it("only offers networks allowed by the host config", async () => {
    setup({ presetGroups: ["amtrak"] });
    expect(screen.getByRole("button", { name: /Amtrak/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Metro-North/ })).not.toBeInTheDocument();
  });

  it("adds a selected route with its resolved transit mode", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/Search networks/), "Acela");
    await userEvent.click(screen.getByRole("button", { name: /Acela/ }));

    expect(screen.getByTestId("routes")).toHaveTextContent("Acela:hsr");
  });

  it("shows a loading state, then renders an async-injected catalog", async () => {
    let resolve!: (c: PresetCatalog) => void;
    const deferred = new Promise<PresetCatalog>((r) => (resolve = r));
    const loader = vi.fn(() => deferred);
    setup({}, loader);

    expect(screen.getByText(/Loading routes/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /MyNet/ })).not.toBeInTheDocument();

    resolve(CATALOG);
    expect(await screen.findByRole("button", { name: /MyNet/ })).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("surfaces a load error and retries", async () => {
    const loader = vi
      .fn<() => Promise<PresetCatalog>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(CATALOG);
    setup({}, loader);

    expect(await screen.findByText(/Couldn't load preset routes/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("button", { name: /MyNet/ })).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("ignores the bundled catalog when a host injects its own", async () => {
    setup({}, CATALOG);
    expect(await screen.findByRole("button", { name: /MyNet/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Amtrak/ })).not.toBeInTheDocument();
  });
});
