import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { zipSync, strToU8 } from "fflate";
import { EditorConfigProvider, type EditorConfig } from "../../context/ConfigContext";
import { MapDataProvider, useMapData } from "../../context/MapDataContext";
import type { RouteCatalog, PresetSource } from "../../lib/presets";
import { PresetRoutesModal } from "./PresetLinesModal";

const CATALOG: RouteCatalog = {
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

const GTFS_ZIP = zipSync({
  "agency.txt": strToU8("agency_id,agency_name\nBART,Bay Area Rapid Transit\n"),
  "routes.txt": strToU8("route_id,route_type,route_long_name\nRED,1,Richmond Line\n"),
  "trips.txt": strToU8("route_id,trip_id\nRED,t1\n"),
  "stops.txt": strToU8(
    "stop_id,stop_name,stop_lat,stop_lon\nRICH,Richmond,37.94,-122.35\nMONT,Montgomery,37.79,-122.40\n"
  ),
  "stop_times.txt": strToU8("trip_id,stop_id,stop_sequence\nt1,RICH,1\nt1,MONT,2\n"),
});

describe("PresetRoutesModal", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("expands the first network by default and keeps later ones collapsed", async () => {
    setup();
    // Amtrak (the first network) is open by default...
    expect(await screen.findByRole("button", { name: /Acela/ })).toBeInTheDocument();
    // ...but a later network stays collapsed until clicked.
    expect(screen.queryByRole("button", { name: /New Haven Line/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Metro-North/ }));
    expect(screen.getByRole("button", { name: /New Haven Line/ })).toBeInTheDocument();
  });

  it("imports and offers routes from a pasted GTFS feed URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => GTFS_ZIP.buffer,
      }))
    );
    setup({ enableFeedImport: true });

    await userEvent.type(
      screen.getByLabelText(/Paste a GTFS feed URL/),
      "https://example.com/bart.zip"
    );
    await userEvent.click(screen.getByRole("button", { name: "Fetch" }));

    // The pasted network's route becomes selectable (its group auto-expands).
    expect(await screen.findByRole("button", { name: /Richmond Line/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Richmond Line/ }));
    expect(screen.getByTestId("routes")).toHaveTextContent("Richmond Line:subway");
  });

  it("surfaces an import error for a feed that can't be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, statusText: "Not Found" }))
    );
    setup({ enableFeedImport: true });

    await userEvent.type(screen.getByLabelText(/Paste a GTFS feed URL/), "https://example.com/x.zip");
    await userEvent.click(screen.getByRole("button", { name: "Fetch" }));

    expect(await screen.findByText(/404/)).toBeInTheDocument();
  });

  it("hides the feed-import control unless the host enables it", async () => {
    setup();
    expect(await screen.findByLabelText(/Search networks/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Paste a GTFS feed URL/)).not.toBeInTheDocument();
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
    // Amtrak is offered (its routes are visible via the default expand)...
    expect(await screen.findByRole("button", { name: /Northeast Regional/ })).toBeInTheDocument();
    // ...Metro-North is filtered out entirely.
    expect(screen.queryByRole("button", { name: /Metro-North/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New Haven Line/ })).not.toBeInTheDocument();
  });

  it("adds a selected route with its resolved transit mode", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/Search networks/), "Acela");
    await userEvent.click(screen.getByRole("button", { name: /Acela/ }));

    expect(screen.getByTestId("routes")).toHaveTextContent("Acela:hsr");
  });

  it("shows a loading state, then renders an async-injected catalog", async () => {
    let resolve!: (c: RouteCatalog) => void;
    const deferred = new Promise<RouteCatalog>((r) => (resolve = r));
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
      .fn<() => Promise<RouteCatalog>>()
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
