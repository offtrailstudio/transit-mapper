import { TransitMapData } from "./types";

/**
 * A single map as it lives in the cloud `maps` table (and the local mirror we
 * reconcile against it). `id` is shared between localStorage and the cloud row,
 * so a map has one identity everywhere. `updatedAt` is epoch milliseconds — the
 * cloud's authoritative `updated_at` timestamptz, parsed to ms at the boundary.
 */
export type CloudMap = {
  id: string;
  name: string;
  data: TransitMapData;
  updatedAt: number;
  /** Cloud id this map was forked from, or null/undefined for an original. */
  forkedFrom?: string | null;
};

/**
 * What to do after comparing the local set against the cloud set on sign-in.
 * `merged` is the reconciled set that should become local state; `push`/`pull`
 * are the writes needed to make cloud and local agree.
 */
export type SyncPlan = {
  /** Local maps to upsert into the cloud (local-only, or local edited more recently). */
  push: CloudMap[];
  /** Cloud maps to write into local state (cloud-only, or cloud edited more recently). */
  pull: CloudMap[];
  /** The full reconciled set — local order first, then cloud-only maps appended. */
  merged: CloudMap[];
};

/**
 * Reconciles the signed-in user's local maps with their cloud maps by id, using
 * last-write-wins on `updatedAt`:
 *
 *  - id only local  → push it up (this is the signed-out → signed-up migration:
 *    maps built before creating an account come along).
 *  - id only cloud  → pull it down (a map made on another device).
 *  - id on both     → the newer `updatedAt` wins; equal timestamps are a no-op
 *    (treated as already in agreement, local copy kept).
 *
 * Deliberately does NOT handle cross-device deletes: with last-write-wins and no
 * tombstones, a map deleted locally but still present in the cloud reappears on
 * next sync. Distinguishing "deleted" from "never seen here" needs a tombstone
 * table — a Phase-2 concern. Callers relying on delete propagation must add that
 * before trusting it.
 */
export function reconcileMaps(local: CloudMap[], remote: CloudMap[]): SyncPlan {
  const remoteById = new Map(remote.map((m) => [m.id, m]));
  const localById = new Map(local.map((m) => [m.id, m]));

  const push: CloudMap[] = [];
  const pull: CloudMap[] = [];
  const merged: CloudMap[] = [];

  // Local order first — keeps the gallery stable for the maps already on-device.
  for (const localMap of local) {
    const remoteMap = remoteById.get(localMap.id);
    if (!remoteMap) {
      push.push(localMap);
      merged.push(localMap);
      continue;
    }
    if (localMap.updatedAt > remoteMap.updatedAt) {
      push.push(localMap);
      merged.push(localMap);
    } else if (remoteMap.updatedAt > localMap.updatedAt) {
      pull.push(remoteMap);
      merged.push(remoteMap);
    } else {
      // In agreement (equal timestamps) — nothing to write, keep the local copy.
      merged.push(localMap);
    }
  }

  // Cloud-only maps: pull them down and append in cloud order.
  for (const remoteMap of remote) {
    if (!localById.has(remoteMap.id)) {
      pull.push(remoteMap);
      merged.push(remoteMap);
    }
  }

  return { push, pull, merged };
}
