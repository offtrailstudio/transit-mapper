import { describe, expect, it } from "vitest";
import { buildCatalog, CATALOG_FILENAME } from "./build-catalog";
import { PRESET_SCHEMA_VERSION } from "../src/lib/presets";

const OPTS = {
  version: "1.4.0",
  generatedAt: "2026-08-20T00:00:00.000Z",
  summary: "Added SEPTA Regional Rail",
  url: "https://example.com/presets.v2.json",
};

describe("buildCatalog", () => {
  it("stamps version + generatedAt onto a validated catalog", () => {
    const { catalog } = buildCatalog(OPTS);
    expect(catalog.schemaVersion).toBe(PRESET_SCHEMA_VERSION);
    expect(catalog.version).toBe("1.4.0");
    expect(catalog.generatedAt).toBe("2026-08-20T00:00:00.000Z");
    expect(catalog.routes.length).toBeGreaterThan(0);
  });

  it("emits a manifest that mirrors the published version and schema", () => {
    const { manifest } = buildCatalog(OPTS);
    expect(manifest).toEqual({
      latestVersion: "1.4.0",
      schemaVersion: PRESET_SCHEMA_VERSION,
      publishedAt: "2026-08-20T00:00:00.000Z",
      summary: "Added SEPTA Regional Rail",
      url: OPTS.url,
    });
  });

  it("names the artifact by schema version so a v2 can coexist with v1", () => {
    expect(CATALOG_FILENAME).toBe(`presets.v${PRESET_SCHEMA_VERSION}.json`);
  });
});
