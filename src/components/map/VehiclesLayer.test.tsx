import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * A stand-in for the Mapbox map. `remove()` mirrors the real thing: it flips
 * `_removed` and drops the style, so every accessor afterwards throws exactly as
 * mapbox-gl does ("Cannot read properties of undefined (reading 'getOwnLayer')").
 */
function createFakeMap() {
  let removed = false;
  const guard = <T,>(value: T) => {
    if (removed) {
      throw new TypeError("Cannot read properties of undefined (reading 'getOwnLayer')");
    }
    return value;
  };
  return {
    get _removed() {
      return removed;
    },
    remove: () => {
      removed = true;
    },
    isStyleLoaded: () => guard(true),
    getZoom: () => guard(11),
    getSource: () => guard(undefined),
    getLayer: () => guard(undefined),
    addSource: vi.fn(() => guard(undefined)),
    addLayer: vi.fn(() => guard(undefined)),
    once: vi.fn(),
    off: vi.fn(() => guard(undefined)),
  };
}

const fakeMap = createFakeMap();

vi.mock("react-map-gl/mapbox", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MapProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
  Marker: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Popup: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useMap: () => ({ current: { getMap: () => fakeMap } }),
}));

const { MapDataProvider } = await import("../../context/MapDataContext");
const { SimModeProvider } = await import("../../context/SimModeContext");
const { VehiclesLayer } = await import("./VehiclesLayer");

function renderLayer() {
  return render(
    <MapDataProvider>
      <SimModeProvider>
        <VehiclesLayer />
      </SimModeProvider>
    </MapDataProvider>
  );
}

describe("VehiclesLayer teardown", () => {
  it("removes its layer and source when the map is still alive", () => {
    const { unmount } = renderLayer();

    expect(() => unmount()).not.toThrow();
    expect(fakeMap.off).toHaveBeenCalledWith("styledata", expect.any(Function));
  });

  it("leaves an already-removed map alone", () => {
    // react-map-gl tears the Mapbox map down before its children's effects run,
    // so on a route change this cleanup meets a destroyed map. Touching it threw
    // and surfaced as a client error on every navigation away from the editor.
    const { unmount } = renderLayer();
    fakeMap.off.mockClear();
    fakeMap.remove();

    expect(() => unmount()).not.toThrow();
    expect(fakeMap.off).not.toHaveBeenCalled();
  });
});
