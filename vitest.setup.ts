import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// Both MapEditor and StationSearch read this at module scope and render a
// "set your token" fallback without it, so it has to exist before any test
// module is imported — setupFiles run early enough for that.
process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??= "pk.test-token";

// jsdom implements no matchMedia at all, which useColorScheme calls during render.
// Defaults to light so tests get a deterministic scheme.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom ships a Crypto without randomUUID, which the reducer and projects file
// both call to mint ids — without this every render that creates a map throws.
if (!globalThis.crypto?.randomUUID) {
  let counter = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${String(counter++).padStart(12, "0")}`,
  });
}
