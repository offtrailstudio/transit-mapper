"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Modal } from "../Modal";
import { useMapData } from "../../context/MapDataContext";
import { useEditorConfig } from "../../context/ConfigContext";
import { useRouteSource } from "../../context/RouteSourceContext";
import { findRouteMergeCandidates, StationMergeCandidate } from "../../lib/presetMerge";
import { ResolvedRoute, RouteSummary } from "../../lib/presets";
import { ROUTE_TYPE_DEFAULTS } from "../../lib/lineKinds";
import { MergeStationsModal } from "./MergeStationsModal";

/**
 * Find and add a real route to the map. Search-first: the query goes to the
 * host's {@link import("../../lib/presets").RouteSource} (the bundled catalog by
 * default, or a live Mobility Database source), so the same UI works whether
 * there are 60 routes or all of them.
 */
export function AddRouteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useMapData();
  const { routeNetworks } = useEditorConfig();
  const source = useRouteSource();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RouteSummary[]>([]);
  const [search, setSearch] = useState<{ loading: boolean; error: string | null }>({
    loading: true,
    error: null,
  });
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    route: ResolvedRoute;
    candidates: StationMergeCandidate[];
  } | null>(null);

  // Search on query change (debounced) while open, canceling any in-flight query.
  useEffect(() => {
    if (!open) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setSearch({ loading: true, error: null });
        source
          .search(query, { signal: controller.signal })
          .then((found) => {
            if (!controller.signal.aborted) {
              setResults(found);
              setSearch({ loading: false, error: null });
            }
          })
          .catch((cause) => {
            if (!controller.signal.aborted) {
              setSearch({
                loading: false,
                error: cause instanceof Error ? cause.message : "Search failed.",
              });
            }
          });
      },
      query ? 200 : 0
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, source, open]);

  // A host can restrict which networks are offered, by id.
  const visible = routeNetworks
    ? results.filter((r) => r.networkId != null && routeNetworks.includes(r.networkId))
    : results;

  async function select(summary: RouteSummary) {
    if (resolvingId) {
      return;
    }
    setResolvingId(summary.id);
    try {
      const route = await source.resolve(summary.id);
      const candidates = findRouteMergeCandidates(state.data.stops, route.stops);
      if (candidates.length === 0) {
        dispatch({ type: "ADD_CATALOG_ROUTE", route });
        onClose();
        return;
      }
      setPending({ route, candidates });
    } catch (cause) {
      setSearch((s) => ({
        ...s,
        error: cause instanceof Error ? cause.message : "Couldn't add that route.",
      }));
    } finally {
      setResolvingId(null);
    }
  }

  function confirmMerge(merges: Record<number, string>) {
    if (!pending) {
      return;
    }
    dispatch({ type: "ADD_CATALOG_ROUTE", route: pending.route, merges });
    setPending(null);
    onClose();
  }

  if (pending) {
    return (
      <MergeStationsModal
        key={pending.route.id}
        open={open}
        route={pending.route}
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
    <Modal open={open} onClose={onClose} title="Add a route">
      <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
        Search a real transit network and add one of its routes as a starting point. Its stations
        are added alongside whatever&apos;s already here.
      </p>

      <div className="relative mb-3">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search routes and networks (e.g. Amtrak, BART, Acela)"
          aria-label="Search routes and networks"
          autoFocus
          className="w-full rounded-md border border-neutral-300 bg-transparent py-1.5 pl-8 pr-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
        />
      </div>

      <div className="max-h-[70vh] min-h-[8rem] space-y-1.5 overflow-y-auto pr-1">
        {search.loading && (
          <p className="py-6 text-center text-sm text-neutral-500">Searching…</p>
        )}

        {!search.loading && search.error && (
          <p className="py-6 text-center text-sm text-neutral-500">{search.error}</p>
        )}

        {!search.loading && !search.error && visible.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500">
            {query ? "No matching routes." : "Type to search for a route."}
          </p>
        )}

        {!search.loading &&
          !search.error &&
          visible.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => select(route)}
              disabled={resolvingId !== null}
              className="flex w-full items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-left hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: route.color ?? "#999" }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-neutral-900 dark:text-white">
                  {route.name}
                </span>
                {(route.networkName || route.description) && (
                  <span className="block truncate text-xs text-neutral-500">
                    {route.networkName ?? route.description}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                {route.mode && (
                  <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {ROUTE_TYPE_DEFAULTS[route.mode].label}
                  </span>
                )}
                {resolvingId === route.id ? (
                  <Loader2 size={12} className="animate-spin text-neutral-400" />
                ) : (
                  route.stopCount != null && (
                    <span className="text-xs text-neutral-500">{route.stopCount} stops</span>
                  )
                )}
              </span>
            </button>
          ))}
      </div>
    </Modal>
  );
}
