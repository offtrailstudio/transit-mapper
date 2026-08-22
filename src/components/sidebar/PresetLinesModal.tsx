"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Link2, Loader2, Search } from "lucide-react";
import { Modal } from "../Modal";
import { useMapData } from "../../context/MapDataContext";
import { useEditorConfig } from "../../context/ConfigContext";
import { usePresets } from "../../context/PresetsContext";
import { findPresetMergeCandidates, StationMergeCandidate } from "../../lib/presetMerge";
import {
  groupPresetRoutes,
  resolvePresetRoute,
  resolvePresetRouteType,
  PresetCatalog,
  PresetGroup,
  PresetRoute,
  ResolvedPresetRoute,
} from "../../lib/presets";
import type { CatalogFragment } from "../../gtfs";
import { ROUTE_TYPE_DEFAULTS } from "../../lib/lineKinds";
import { MergeStationsModal } from "./MergeStationsModal";

function groupKey(group: PresetGroup | null): string {
  return group?.id ?? "ungrouped";
}

function matchesQuery(route: PresetRoute, group: PresetGroup | null, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = `${route.name} ${route.description ?? ""} ${group?.name ?? ""}`.toLowerCase();
  return haystack.includes(query);
}

/** Overlay pasted GTFS feeds onto the base catalog, deduping groups by id. */
function mergeFragments(catalog: PresetCatalog, fragments: CatalogFragment[]): PresetCatalog {
  if (fragments.length === 0) {
    return catalog;
  }
  const groups = [...catalog.groups];
  const seen = new Set(groups.map((g) => g.id));
  const stops = [...catalog.stops];
  const routes = [...catalog.routes];
  for (const fragment of fragments) {
    for (const group of fragment.groups) {
      if (!seen.has(group.id)) {
        seen.add(group.id);
        groups.push(group);
      }
    }
    stops.push(...fragment.stops);
    routes.push(...fragment.routes);
  }
  return { ...catalog, groups, stops, routes };
}

function importErrorMessage(cause: unknown): string {
  // A cross-origin or offline fetch rejects with a TypeError and no HTTP status.
  if (cause instanceof TypeError) {
    return "Couldn't download that feed — the host may block browser requests (CORS), or the URL is wrong.";
  }
  return cause instanceof Error ? cause.message : "Couldn't import that feed.";
}

export function PresetRoutesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useMapData();
  const { presetGroups } = useEditorConfig();
  const { status, catalog, error, ensureLoaded, reload } = usePresets();
  const [query, setQuery] = useState("");
  // Networks the user has expanded; everything else is collapsed. Tracking the
  // opened set (rather than the closed set) keeps "collapsed by default" correct
  // even though the catalog can arrive asynchronously, after this state inits.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // Feeds the user pasted in ("paste a GTFS link"), overlaid on the catalog.
  const [pastedFeeds, setPastedFeeds] = useState<CatalogFragment[]>([]);
  const [importUrl, setImportUrl] = useState("");
  const [importState, setImportState] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const [pending, setPending] = useState<{
    preset: ResolvedPresetRoute;
    candidates: StationMergeCandidate[];
  } | null>(null);

  // Load the catalog lazily the first time the picker opens.
  useEffect(() => {
    if (open) {
      ensureLoaded();
    }
  }, [open, ensureLoaded]);

  // The catalog plus any pasted feeds — the source the picker renders and adds from.
  const mergedCatalog = useMemo(
    () => (catalog ? mergeFragments(catalog, pastedFeeds) : null),
    [catalog, pastedFeeds]
  );
  // Pasted networks bypass a host's `presetGroups` allowlist — the user asked for them.
  const pastedGroupIds = useMemo(
    () => new Set(pastedFeeds.flatMap((f) => f.groups.map((g) => g.id))),
    [pastedFeeds]
  );

  // A host can restrict which networks are offered (e.g. Amtrak only). Undefined
  // shows everything; an empty allowlist shows nothing (bar pasted feeds).
  const grouped = useMemo(() => {
    if (!mergedCatalog) {
      return [];
    }
    const routes = presetGroups
      ? mergedCatalog.routes.filter(
          (r) =>
            r.groupId != null && (presetGroups.includes(r.groupId) || pastedGroupIds.has(r.groupId))
        )
      : mergedCatalog.routes;
    return groupPresetRoutes(routes, mergedCatalog.groups);
  }, [mergedCatalog, presetGroups, pastedGroupIds]);

  const q = query.trim().toLowerCase();
  const filtered = grouped
    .map(({ group, routes }) => ({
      group,
      routes: routes.filter((route) => matchesQuery(route, group, q)),
    }))
    .filter((section) => section.routes.length > 0);

  // Expand the first network by default (Amtrak in the bundled catalog) so the
  // picker opens showing routes, not just collapsed headers. Seeded once, and
  // only while the user hasn't opened anything themselves.
  const didSeedExpand = useRef(false);
  useEffect(() => {
    if (didSeedExpand.current || grouped.length === 0) {
      return;
    }
    didSeedExpand.current = true;
    setExpanded((prev) => (prev.size > 0 ? prev : new Set([groupKey(grouped[0].group)])));
  }, [grouped]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function importFeed() {
    const url = importUrl.trim();
    if (!url || importState.loading) {
      return;
    }
    setImportState({ loading: true, error: null });
    try {
      // Lazy-load the GTFS parser (fflate + csv-parse) only when actually used,
      // so it stays out of the editor's initial bundle.
      const { fetchGtfsCatalog } = await import("../../gtfs");
      const fragment = await fetchGtfsCatalog(url, { idPrefix: `pasted-${pastedFeeds.length + 1}` });
      if (fragment.routes.length === 0) {
        throw new Error("No routes the editor can use were found in that feed.");
      }
      setPastedFeeds((prev) => [...prev, fragment]);
      // Reveal the newly added network(s) immediately.
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const group of fragment.groups) {
          next.add(group.id);
        }
        return next;
      });
      setImportUrl("");
      setImportState({ loading: false, error: null });
    } catch (cause) {
      setImportState({ loading: false, error: importErrorMessage(cause) });
    }
  }

  function selectPreset(preset: PresetRoute, group: PresetGroup | null) {
    if (!mergedCatalog) {
      return;
    }
    const resolved: ResolvedPresetRoute = {
      ...resolvePresetRoute(mergedCatalog, preset),
      routeType: resolvePresetRouteType(preset, group),
    };
    const candidates = findPresetMergeCandidates(state.data.stops, resolved.stops);
    if (candidates.length === 0) {
      dispatch({ type: "ADD_PRESET_ROUTE", preset: resolved });
      onClose();
      return;
    }
    setPending({ preset: resolved, candidates });
  }

  function confirmMerge(merges: Record<number, string>) {
    if (!pending) {
      return;
    }
    dispatch({ type: "ADD_PRESET_ROUTE", preset: pending.preset, merges });
    setPending(null);
    onClose();
  }

  if (pending) {
    return (
      <MergeStationsModal
        key={pending.preset.id}
        open={open}
        preset={pending.preset}
        candidates={pending.candidates}
        onBack={() => setPending(null)}
        onConfirm={confirmMerge}
        onClose={() => {
          setPending(null);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a preset route">
      <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
        Add a real-world transit route to this map as a starting point. Its stations are added
        alongside whatever&apos;s already here.
      </p>

      {status === "ready" && (
        <div className="relative mb-3">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search networks and routes"
            aria-label="Search networks and routes"
            className="w-full rounded-md border border-neutral-300 bg-transparent py-1.5 pl-8 pr-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
          />
        </div>
      )}

      {status === "ready" && (
        <div className="mb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void importFeed();
                  }
                }}
                placeholder="Paste a GTFS feed (.zip) URL"
                aria-label="Paste a GTFS feed URL"
                className="w-full rounded-md border border-neutral-300 bg-transparent py-1.5 pl-8 pr-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
              />
            </div>
            <button
              type="button"
              onClick={() => void importFeed()}
              disabled={!importUrl.trim() || importState.loading}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {importState.loading && <Loader2 size={14} className="animate-spin" />}
              {importState.loading ? "Fetching…" : "Fetch"}
            </button>
          </div>
          {importState.error && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{importState.error}</p>
          )}
        </div>
      )}

      <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
        {status === "loading" && (
          <p className="py-6 text-center text-sm text-neutral-500">Loading routes…</p>
        )}

        {status === "error" && (
          <div className="py-6 text-center">
            <p className="text-sm text-neutral-500">
              Couldn&apos;t load preset routes{error ? `: ${error.message}` : "."}
            </p>
            <button
              type="button"
              onClick={reload}
              className="mt-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Try again
            </button>
          </div>
        )}

        {status === "ready" && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500">No matching routes.</p>
        )}

        {status === "ready" &&
          filtered.map(({ group, routes }) => {
            const key = groupKey(group);
            const isOpen = q.length > 0 || expanded.has(key);
            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-1.5 py-1 text-left"
                >
                  {isOpen ? (
                    <ChevronDown size={14} className="shrink-0 text-neutral-400" />
                  ) : (
                    <ChevronRight size={14} className="shrink-0 text-neutral-400" />
                  )}
                  <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {group?.name ?? "Other"}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                    {routes.length}
                  </span>
                </button>
                {isOpen && (
                  <ul className="mt-1 space-y-1.5">
                    {routes.map((preset) => {
                      const routeType = resolvePresetRouteType(preset, group);
                      return (
                        <li key={preset.id}>
                          <button
                            type="button"
                            onClick={() => selectPreset(preset, group)}
                            className="flex w-full items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-left hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                          >
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ backgroundColor: preset.color ?? "#999" }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-base font-medium text-neutral-900 dark:text-white">
                                {preset.name}
                              </span>
                              {preset.description && (
                                <span className="block truncate text-xs text-neutral-500">
                                  {preset.description}
                                </span>
                              )}
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-0.5">
                              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                                {ROUTE_TYPE_DEFAULTS[routeType].label}
                              </span>
                              <span className="text-xs text-neutral-500">
                                {preset.patterns[0]?.stopIds.length ?? 0} stops
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
      </div>
    </Modal>
  );
}
