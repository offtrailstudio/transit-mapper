import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom for everything: the pure lib/ tests are environment-agnostic, so one
    // setting keeps component tests from needing a per-file annotation. Package
    // internals use relative imports, so no path-alias resolution is needed.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
