/**
 * Emits the hostable preset artifacts from the bundled catalog:
 *
 *   catalog-dist/presets.v<schema>.json  — the full, validated PresetCatalog
 *   catalog-dist/manifest.json           — latest version + schema + summary
 *
 * This is the migration on-ramp: it runs against the routes that live in this
 * package today, and lifts unchanged into a dedicated `transit-networks` data
 * repo later (where it would import the catalog from published route files
 * instead of the bundled default). CI runs it on every PR so a catalog that
 * can't assemble or validate never merges.
 *
 *   npm run build:catalog -- 1.4.0        # or CATALOG_VERSION=1.4.0 npm run build:catalog
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_PRESET_CATALOG,
  PRESET_SCHEMA_VERSION,
  validatePresetCatalog,
  type PresetCatalog,
  type PresetManifest,
} from "../src/lib/presets/index";

export type BuildCatalogOptions = {
  version: string;
  /** ISO-8601 build time; injected so the build is deterministic under test. */
  generatedAt: string;
  summary?: string;
  /** Public URL the versioned file will be served from (recorded in the manifest). */
  url?: string;
};

export function buildCatalog(opts: BuildCatalogOptions): {
  catalog: PresetCatalog;
  manifest: PresetManifest;
} {
  // Validate the assembled catalog exactly as a remote loader would validate a
  // downloaded one — the build fails loudly on a bad route rather than shipping it.
  const catalog = validatePresetCatalog({
    ...DEFAULT_PRESET_CATALOG,
    version: opts.version,
    generatedAt: opts.generatedAt,
  });
  const manifest: PresetManifest = {
    latestVersion: opts.version,
    schemaVersion: PRESET_SCHEMA_VERSION,
    publishedAt: opts.generatedAt,
    summary: opts.summary ?? "",
    url: opts.url ?? "",
  };
  return { catalog, manifest };
}

export const CATALOG_FILENAME = `presets.v${PRESET_SCHEMA_VERSION}.json`;

function main() {
  const version = process.env.CATALOG_VERSION ?? process.argv[2] ?? "0.0.0-dev";
  const { catalog, manifest } = buildCatalog({
    version,
    generatedAt: new Date().toISOString(),
    summary: process.env.CATALOG_SUMMARY,
    url: process.env.CATALOG_URL,
  });

  const outDir = join(process.cwd(), "catalog-dist");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, CATALOG_FILENAME), JSON.stringify(catalog, null, 2) + "\n");
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(
    `Wrote ${CATALOG_FILENAME} (v${version}, ${catalog.routes.length} routes across ` +
      `${catalog.groups.length} networks) and manifest.json to catalog-dist/`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
