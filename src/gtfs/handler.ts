import {
  ROUTE_CATALOG_SCHEMA_VERSION,
  staticRouteSource,
  type ResolvedRoute,
  type RouteSource,
  type RouteSummary,
} from "../lib/presets";
import {
  downloadDataset,
  getAccessToken,
  getFeed,
  listFeedsByProvider,
  type FetchLike,
} from "./mobilityDatabase";
import { parseGtfsZip } from "./parse";
import { transformGtfs } from "./transform";

export type MobilityDatabaseHandlerOptions = {
  /** The account refresh token — held here, on the server. */
  refreshToken: string;
  /** Feeds to expand per search; each is downloaded + parsed (cached). Default 3. */
  maxFeedsPerSearch?: number;
  /** Cap on routes returned per search. Default 300. */
  maxResults?: number;
  /** Override the global `fetch` (tests). */
  fetchImpl?: FetchLike;
  /** Access-token lifetime before re-exchange, ms. Default 50 min. */
  tokenTtlMs?: number;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * A framework-agnostic request handler that turns Mobility Database feeds into a
 * searchable route source. Mount it in your app (Next.js route handler, Hono, Bun,
 * Deno, Cloudflare Workers — anything speaking Web `Request`/`Response`); it holds
 * the token and does the heavy GTFS parsing server-side, returning small JSON.
 * Pair with `mobilityDatabaseRouteSource({ endpoint })` on the client.
 *
 * Protocol (query params): `?op=search&q=<network>` → `RouteSummary[]`;
 * `?op=resolve&id=<summary id>` → `ResolvedRoute`.
 *
 * Because Mobility Database search is agency-level, `q` matches a *network* name
 * (e.g. "Amtrak", "BART") and returns that network's routes. Parsed feeds are
 * cached per process — put a CDN in front for shared, durable caching.
 */
export function createMobilityDatabaseHandler(
  options: MobilityDatabaseHandlerOptions
): (request: Request) => Promise<Response> {
  const {
    refreshToken,
    maxFeedsPerSearch = 3,
    maxResults = 300,
    fetchImpl = fetch,
    tokenTtlMs = 50 * 60 * 1000,
  } = options;

  let token: { value: string; expiresAt: number } | null = null;
  // feedId -> the feed's routes as a static source (parse once, reuse).
  const feedSources = new Map<string, Promise<RouteSource>>();

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now()) {
      return token.value;
    }
    const value = await getAccessToken(refreshToken, fetchImpl);
    token = { value, expiresAt: Date.now() + tokenTtlMs };
    return value;
  }

  async function feedSource(feedId: string, hostedUrl?: string): Promise<RouteSource> {
    const existing = feedSources.get(feedId);
    if (existing) {
      return existing;
    }
    const built = (async () => {
      let url = hostedUrl;
      if (!url) {
        const feed = await getFeed(await accessToken(), feedId, fetchImpl);
        url = feed.latest_dataset?.hosted_url;
      }
      if (!url) {
        throw new Error(`Feed ${feedId} has no downloadable dataset`);
      }
      const fragment = transformGtfs(parseGtfsZip(await downloadDataset(url, fetchImpl)), {
        idPrefix: feedId,
      });
      return staticRouteSource({ schemaVersion: ROUTE_CATALOG_SCHEMA_VERSION, ...fragment });
    })();
    feedSources.set(feedId, built);
    // Don't cache a rejection permanently.
    built.catch(() => feedSources.delete(feedId));
    return built;
  }

  async function search(query: string): Promise<RouteSummary[]> {
    const q = query.trim();
    if (!q) {
      return [];
    }
    const feeds = (await listFeedsByProvider(await accessToken(), q, fetchImpl))
      .filter((feed) => feed.latest_dataset?.hosted_url)
      .slice(0, maxFeedsPerSearch);

    const perFeed = await Promise.all(
      feeds.map(async (feed) => {
        try {
          const source = await feedSource(feed.id, feed.latest_dataset?.hosted_url);
          return source.search("");
        } catch {
          return [] as RouteSummary[];
        }
      })
    );
    return perFeed.flat().slice(0, maxResults);
  }

  async function resolve(id: string): Promise<ResolvedRoute> {
    const feedId = id.slice(0, id.indexOf(":"));
    if (!feedId) {
      throw new Error(`Malformed route id: ${id}`);
    }
    return (await feedSource(feedId)).resolve(id);
  }

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const op = url.searchParams.get("op");
    try {
      if (op === "search") {
        return json(await search(url.searchParams.get("q") ?? ""));
      }
      if (op === "resolve") {
        const id = url.searchParams.get("id");
        if (!id) {
          return json({ error: "missing id" }, 400);
        }
        return json(await resolve(id));
      }
      return json({ error: "unknown op — expected search or resolve" }, 400);
    } catch (cause) {
      return json({ error: cause instanceof Error ? cause.message : "request failed" }, 502);
    }
  };
}
