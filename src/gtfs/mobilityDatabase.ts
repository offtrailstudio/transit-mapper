/**
 * A thin client for the Mobility Database API (https://mobilitydatabase.org).
 * The flow: exchange a long-lived refresh token for a short-lived access token,
 * look a feed up by provider (or pinned id), then download its latest GTFS
 * dataset from the no-auth `hosted_url`. Every call takes an injectable `fetch`
 * so the assembler is testable without network.
 *
 * Confirmed against docs/DatabaseCatalog*API.yaml in MobilityData/mobility-feed-api.
 */
const API_BASE = "https://api.mobilitydatabase.org/v1";

export type FetchLike = typeof fetch;

export type GtfsFeed = {
  id: string;
  provider?: string;
  latest_dataset?: { hosted_url?: string } | null;
};

/** POST /v1/tokens/access — trade the account refresh token for a bearer access token. */
export async function getAccessToken(refreshToken: string, fetchImpl: FetchLike = fetch): Promise<string> {
  const res = await fetchImpl(`${API_BASE}/tokens/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    throw new Error(`Mobility Database token exchange failed (${res.status} ${res.statusText})`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("Mobility Database token response had no access_token");
  }
  return body.access_token;
}

async function authedJson<T>(path: string, token: string, fetchImpl: FetchLike): Promise<T> {
  const res = await fetchImpl(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Mobility Database GET ${path} failed (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as T;
}

/** GET /v1/gtfs_feeds?provider=… — feeds whose provider matches (server-side substring). */
export function listFeedsByProvider(
  token: string,
  provider: string,
  fetchImpl: FetchLike = fetch
): Promise<GtfsFeed[]> {
  return authedJson<GtfsFeed[]>(`/gtfs_feeds?provider=${encodeURIComponent(provider)}`, token, fetchImpl);
}

/** GET /v1/gtfs_feeds/{id} — a single feed pinned by its Mobility Database id (e.g. "mdb-10"). */
export function getFeed(token: string, id: string, fetchImpl: FetchLike = fetch): Promise<GtfsFeed> {
  return authedJson<GtfsFeed>(`/gtfs_feeds/${encodeURIComponent(id)}`, token, fetchImpl);
}

/**
 * Pick the feed to ingest from a provider search: the first that actually has a
 * downloadable latest dataset. Returns null when none do, so the caller can log
 * a skip rather than crash the whole build on one missing feed.
 */
export function pickFeed(feeds: GtfsFeed[]): GtfsFeed | null {
  return feeds.find((feed) => !!feed.latest_dataset?.hosted_url) ?? null;
}

/** Download a dataset from its no-auth `hosted_url` as raw zip bytes. */
export async function downloadDataset(hostedUrl: string, fetchImpl: FetchLike = fetch): Promise<Uint8Array> {
  const res = await fetchImpl(hostedUrl);
  if (!res.ok) {
    throw new Error(`Dataset download failed (${res.status} ${res.statusText}) for ${hostedUrl}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
