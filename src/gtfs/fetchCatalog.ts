import { downloadDataset, type FetchLike } from "./mobilityDatabase";
import { parseGtfsZip } from "./parse";
import { transformGtfs, type CatalogFragment } from "./transform";

export type FetchGtfsCatalogOptions = {
  /** Namespaces every id the feed contributes so pasted feeds can't collide. */
  idPrefix: string;
  /** Override for tests; defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
};

/**
 * Fetch a GTFS `.zip` from a URL and transform it into a catalog fragment — the
 * "paste a GTFS link" path. Runs in the browser: `fflate`/`csv-parse` are
 * isomorphic, so the same transform used at build time works client-side. Accepts
 * any no-auth GTFS zip URL, including a Mobility Database `latest_dataset.hosted_url`.
 *
 * Heavy parsing deps load with this module, so callers should reach it via a lazy
 * `import()` to keep them out of the initial bundle. A cross-origin host that
 * doesn't send CORS headers will reject the fetch (a `TypeError`) — the caller
 * surfaces that; the package can't work around it.
 */
export async function fetchGtfsCatalog(
  url: string,
  options: FetchGtfsCatalogOptions
): Promise<CatalogFragment> {
  const zip = await downloadDataset(url, options.fetchImpl);
  return transformGtfs(parseGtfsZip(zip), { idPrefix: options.idPrefix });
}
