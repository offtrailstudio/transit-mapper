import { parseTransitMapData } from "./transitMapFile";
import { EMPTY_MAP_DATA, TransitMapData } from "./types";

export const STORAGE_KEY = "transit-map:v1";

/** Pure parse/validate step, kept separate from localStorage access so it's easy to unit test. */
export function parseStoredMap(json: string | null): TransitMapData {
  if (!json) {
    return EMPTY_MAP_DATA;
  }
  return parseTransitMapData(json) ?? EMPTY_MAP_DATA;
}

export function loadMap(): TransitMapData {
  if (typeof window === "undefined") {
    return EMPTY_MAP_DATA;
  }
  return parseStoredMap(window.localStorage.getItem(STORAGE_KEY));
}

export function saveMap(data: TransitMapData): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
