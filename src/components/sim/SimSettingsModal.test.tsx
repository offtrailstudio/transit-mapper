import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

const { MapDataProvider, SharedMapProvider } = await import("../../context/MapDataContext");
const { SimSettingsModal } = await import("./SimSettingsModal");

const DATA = {
  version: 3 as const,
  title: "Test",
  stops: [{ id: "p1", name: "Alpha", lng: 1, lat: 2 }],
  routes: [{ id: "route-a", name: "Red", routeColor: "#ee352e", patterns: [{ id: "route-a-p", stopIds: ["p1"] }] }],
};

function renderShared() {
  return render(
    <MapDataProvider>
      <SharedMapProvider id="route-a" data={DATA}>
        <SimSettingsModal open onClose={() => {}} />
      </SharedMapProvider>
    </MapDataProvider>
  );
}

describe("SimSettingsModal (read-only)", () => {
  it("opens and shows the values but disables every control on a shared map", () => {
    renderShared();

    expect(screen.getByText("Simulation settings")).toBeInTheDocument();
    expect(screen.getByText(/read-only on a shared map/i)).toBeInTheDocument();

    // Line type + frequency are visible but not editable.
    expect(screen.getByLabelText(/minutes between departures/i)).toBeDisabled();
    const routesTab = screen.getByRole("list");
    expect(within(routesTab).getByRole("combobox")).toBeDisabled();
  });
});
