/**
 * Server/build-time GTFS ingest — the `@offtrailstudio/transit-mapper/gtfs`
 * entry point. The host (which holds the Mobility Database refresh token, just
 * as it holds the Mapbox token) calls {@link assembleCatalog} to build a
 * validated `RouteCatalog` from live feeds, then serves/injects that JSON into
 * the editor via `MapDataProvider`'s `presets` prop.
 *
 * This module is intentionally kept out of the browser entry (`.`): it depends
 * on `fflate` + `csv-parse` (optional peer deps) and is never needed at runtime
 * in the client bundle.
 */
export { assembleCatalog, combineFragments, type AssembleOptions } from "./assemble";
export { fetchGtfsCatalog, type FetchGtfsCatalogOptions } from "./fetchCatalog";
export { transformGtfs, type CatalogFragment, type TransformOptions } from "./transform";
export { parseGtfsZip, type GtfsTables, type GtfsRow } from "./parse";
export { routeTypeFromGtfs } from "./routeType";
export { NETWORKS, type NetworkSpec } from "./networks";
export {
  getAccessToken,
  listFeedsByProvider,
  getFeed,
  pickFeed,
  downloadDataset,
  type GtfsFeed,
  type FetchLike,
} from "./mobilityDatabase";
