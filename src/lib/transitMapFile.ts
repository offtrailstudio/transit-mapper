import { normalizeMapData } from "./migrate";
import { TransitMapData } from "./types";

/** Pure parse/validate step, kept separate from localStorage/file I/O so it's easy to unit test. */
export function parseTransitMapData(json: string): TransitMapData | null {
  try {
    const parsed = JSON.parse(json);
    const isValid =
      parsed &&
      (parsed.version === 1 || parsed.version === 2 || parsed.version === 3) &&
      Array.isArray(parsed.stops) &&
      Array.isArray(parsed.routes);
    if (!isValid) {
      return null;
    }
    // `title` was added after some maps were already saved — default it so
    // older data still loads instead of failing validation. `normalizeMapData`
    // then backfills the simulation params and bumps v1 → v2.
    const withTitle = { ...parsed, title: typeof parsed.title === "string" ? parsed.title : "" };
    return normalizeMapData(withTitle as TransitMapData);
  } catch {
    return null;
  }
}

export function serializeTransitMapData(data: TransitMapData): string {
  return JSON.stringify(data, null, 2);
}
