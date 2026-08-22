/**
 * Emits the hostable preset artifacts:
 *
 *   catalog-dist/presets.v<schema>.json  — the full, validated RouteCatalog
 *   catalog-dist/manifest.json           — latest version + schema + summary
 *
 * Source of the catalog, in order of preference:
 *   1. Live GTFS from the Mobility Database (https://mobilitydatabase.org) when
 *      MOBILITY_DATABASE_REFRESH_TOKEN is set — the intended production path, so
 *      route data tracks the real feeds instead of hand-authored coordinates.
 *   2. The bundled catalog otherwise — offline fallback, and what CI validates on
 *      every PR so a catalog that can't assemble or validate never merges.
 *
 *   npm run build:catalog -- 1.4.0        # or CATALOG_VERSION=1.4.0 npm run build:catalog
 *   MOBILITY_DATABASE_REFRESH_TOKEN=… npm run build:catalog -- 2.0.0   # from live GTFS
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BUNDLED_ROUTE_CATALOG,
  ROUTE_CATALOG_SCHEMA_VERSION,
  validateRouteCatalog,
  type RouteCatalog,
  type RouteCatalogManifest,
} from "../src/lib/presets/index";
import { assembleCatalog } from "../src/gtfs";

export type BuildCatalogOptions = {
  version: string;
  /** ISO-8601 build time; injected so the build is deterministic under test. */
  generatedAt: string;
  summary?: string;
  /** Public URL the versioned file will be served from (recorded in the manifest). */
  url?: string;
};

export function makeManifest(opts: BuildCatalogOptions): RouteCatalogManifest {
  return {
    latestVersion: opts.version,
    schemaVersion: ROUTE_CATALOG_SCHEMA_VERSION,
    publishedAt: opts.generatedAt,
    summary: opts.summary ?? "",
    url: opts.url ?? "",
  };
}

export function buildCatalog(opts: BuildCatalogOptions): {
  catalog: RouteCatalog;
  manifest: RouteCatalogManifest;
} {
  // Validate the assembled catalog exactly as a remote loader would validate a
  // downloaded one — the build fails loudly on a bad route rather than shipping it.
  const catalog = validateRouteCatalog({
    ...BUNDLED_ROUTE_CATALOG,
    version: opts.version,
    generatedAt: opts.generatedAt,
  });
  return { catalog, manifest: makeManifest(opts) };
}

export const CATALOG_FILENAME = `presets.v${ROUTE_CATALOG_SCHEMA_VERSION}.json`;

async function main() {
  const version = process.env.CATALOG_VERSION ?? process.argv[2] ?? "0.0.0-dev";
  const opts: BuildCatalogOptions = {
    version,
    generatedAt: new Date().toISOString(),
    summary: process.env.CATALOG_SUMMARY,
    url: process.env.CATALOG_URL,
  };

  const refreshToken = process.env.MOBILITY_DATABASE_REFRESH_TOKEN;
  let catalog: RouteCatalog;
  let manifest: RouteCatalogManifest;
  if (refreshToken) {
    console.log("Assembling catalog from live Mobility Database GTFS feeds…");
    catalog = await assembleCatalog({
      refreshToken,
      version: opts.version,
      generatedAt: opts.generatedAt,
    });
    manifest = makeManifest(opts);
  } else {
    console.log("MOBILITY_DATABASE_REFRESH_TOKEN not set — building from the bundled catalog.");
    ({ catalog, manifest } = buildCatalog(opts));
  }

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
  main().catch((cause) => {
    console.error(cause instanceof Error ? cause.message : cause);
    process.exit(1);
  });
}
