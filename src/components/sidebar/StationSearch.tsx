"use client";

import { useEffect, useState } from "react";
import { useEditorConfig } from "../../context/ConfigContext";

type GeocodeFeature = {
  id?: string;
  properties: {
    name: string;
    full_address?: string;
    place_formatted?: string;
    coordinates: { longitude: number; latitude: number };
  };
};

type GeocodeResponse = { features: GeocodeFeature[] };

export type Suggestion = {
  id: string;
  name: string;
  fullAddress: string;
  lng: number;
  lat: number;
};

/** Geocoder input only — the caller decides what selecting a place does with it. */
export function StationSearch({
  onSelect,
  autoFocus = false,
}: {
  onSelect: (suggestion: Suggestion) => void;
  autoFocus?: boolean;
}) {
  const { mapboxToken } = useEditorConfig();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!mapboxToken || query.trim().length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
      url.searchParams.set("q", query);
      url.searchParams.set("access_token", mapboxToken);
      url.searchParams.set("autocomplete", "true");
      url.searchParams.set("limit", "5");

      try {
        const response = await fetch(url, { signal: controller.signal });
        const data = (await response.json()) as GeocodeResponse;
        setSuggestions(
          data.features.map((feature, index) => ({
            id: feature.id ?? `${feature.properties.name}-${index}`,
            name: feature.properties.name,
            fullAddress: feature.properties.full_address ?? feature.properties.place_formatted ?? "",
            lng: feature.properties.coordinates.longitude,
            lat: feature.properties.coordinates.latitude,
          }))
        );
        setIsOpen(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, mapboxToken]);

  if (!mapboxToken) {
    return null;
  }

  function selectSuggestion(suggestion: Suggestion) {
    onSelect(suggestion);
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Search for a place…"
        className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
      />
      {isOpen && query.trim().length >= 3 && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(suggestion);
                }}
                className="block w-full px-2 py-1.5 text-left transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
              >
                <span className="block truncate text-base font-medium text-neutral-900 dark:text-white">
                  {suggestion.name}
                </span>
                {suggestion.fullAddress && (
                  <span className="block truncate text-xs text-neutral-500">
                    {suggestion.fullAddress}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
