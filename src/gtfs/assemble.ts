import type { PresetCatalog, PresetGroup } from "../lib/presets";
import { PRESET_SCHEMA_VERSION, validatePresetCatalog } from "../lib/presets";
import { parseGtfsZip } from "./parse";
import { transformGtfs, type CatalogFragment } from "./transform";
import {
  downloadDataset,
  getAccessToken,
  getFeed,
  listFeedsByProvider,
  pickFeed,
  type FetchLike,
  type GtfsFeed,
} from "./mobilityDatabase";
import { NETWORKS, type NetworkSpec } from "./networks";

export type AssembleOptions = {
  refreshToken: string;
  networks?: NetworkSpec[];
  version?: string;
  generatedAt?: string;
  fetchImpl?: FetchLike;
  /** Progress/skip reporting — no network is ever dropped silently. */
  log?: (message: string) => void;
};

/** Concatenate per-feed fragments, deduping groups by id (feeds are prefix-isolated otherwise). */
export function combineFragments(fragments: CatalogFragment[]): CatalogFragment {
  const groups = new Map<string, PresetGroup>();
  const stops: CatalogFragment["stops"] = [];
  const routes: CatalogFragment["routes"] = [];
  for (const fragment of fragments) {
    for (const group of fragment.groups) {
      groups.set(group.id, group);
    }
    stops.push(...fragment.stops);
    routes.push(...fragment.routes);
  }
  return { groups: [...groups.values()], stops, routes };
}

async function resolveFeed(
  token: string,
  spec: NetworkSpec,
  fetchImpl: FetchLike
): Promise<GtfsFeed | null> {
  if (spec.feedId) {
    return getFeed(token, spec.feedId, fetchImpl);
  }
  if (spec.provider) {
    return pickFeed(await listFeedsByProvider(token, spec.provider, fetchImpl));
  }
  return null;
}

/**
 * Build a normalized preset catalog from live Mobility Database feeds: exchange
 * the refresh token, then for each curated network resolve its feed, download
 * the latest GTFS dataset, and transform it into a fragment. Fragments combine
 * into one validated catalog. A network that can't be resolved or downloaded is
 * logged and skipped rather than failing the whole build.
 */
export async function assembleCatalog(options: AssembleOptions): Promise<PresetCatalog> {
  const {
    refreshToken,
    networks = NETWORKS,
    version,
    generatedAt,
    fetchImpl = fetch,
    log = (message: string) => console.error(message),
  } = options;

  const token = await getAccessToken(refreshToken, fetchImpl);
  const fragments: CatalogFragment[] = [];

  for (const spec of networks) {
    const label = spec.feedId ?? spec.provider ?? spec.idPrefix;
    try {
      const feed = await resolveFeed(token, spec, fetchImpl);
      const hostedUrl = feed?.latest_dataset?.hosted_url;
      if (!feed || !hostedUrl) {
        log(`skip ${spec.idPrefix}: no downloadable feed for "${label}"`);
        continue;
      }
      const zip = await downloadDataset(hostedUrl, fetchImpl);
      const fragment = transformGtfs(parseGtfsZip(zip), {
        idPrefix: spec.idPrefix,
        resolveRouteType: spec.resolveRouteType,
      });
      log(
        `ok   ${spec.idPrefix}: feed ${feed.id} → ${fragment.routes.length} routes, ${fragment.stops.length} stops`
      );
      fragments.push(fragment);
    } catch (cause) {
      log(`skip ${spec.idPrefix}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  const combined = combineFragments(fragments);
  return validatePresetCatalog({
    schemaVersion: PRESET_SCHEMA_VERSION,
    ...(version ? { version } : {}),
    ...(generatedAt ? { generatedAt } : {}),
    ...combined,
  });
}
