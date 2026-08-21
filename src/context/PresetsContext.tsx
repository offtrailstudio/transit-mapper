"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { DEFAULT_PRESET_CATALOG, PresetCatalog, PresetSource } from "../lib/presets";

type PresetsStatus = "loading" | "ready" | "error";

type PresetsContextValue = {
  status: PresetsStatus;
  /** The resolved catalog, or null while an async source is still loading/errored. */
  catalog: PresetCatalog | null;
  error: Error | null;
  /** Kick off the async load (idempotent). Call when the picker becomes visible. */
  ensureLoaded: () => void;
  /** Retry after an error. */
  reload: () => void;
};

// Default: the bundled catalog, ready immediately. So a component rendered
// outside a PresetsProvider (or in the read-only shared view) still works.
const PresetsContext = createContext<PresetsContextValue>({
  status: "ready",
  catalog: DEFAULT_PRESET_CATALOG,
  error: null,
  ensureLoaded: () => {},
  reload: () => {},
});

type State =
  | { status: "loading"; catalog: null; error: null }
  | { status: "ready"; catalog: PresetCatalog; error: null }
  | { status: "error"; catalog: null; error: Error };

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * Resolves a host-supplied {@link PresetSource} into a catalog for the picker.
 * A plain object (or an omitted source → the bundled default) is ready with no
 * loading flash; a function source is treated as an async loader, invoked lazily
 * the first time `ensureLoaded` is called and cached thereafter.
 */
export function PresetsProvider({
  source,
  children,
}: {
  source?: PresetSource;
  children: ReactNode;
}) {
  const isLoader = typeof source === "function";
  // Read once at mount — like MapDataProvider's loadInitial, the source's
  // identity needn't be stable across renders.
  const sourceRef = useRef(source);
  const startedRef = useRef(!isLoader);

  const [state, setState] = useState<State>(() =>
    isLoader
      ? { status: "loading", catalog: null, error: null }
      : { status: "ready", catalog: (source as PresetCatalog) ?? DEFAULT_PRESET_CATALOG, error: null }
  );

  const ensureLoaded = useCallback(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    const load = sourceRef.current as () => PresetCatalog | Promise<PresetCatalog>;
    setState({ status: "loading", catalog: null, error: null });
    Promise.resolve()
      .then(load)
      .then((catalog) => setState({ status: "ready", catalog, error: null }))
      .catch((cause) => setState({ status: "error", catalog: null, error: toError(cause) }));
  }, []);

  const reload = useCallback(() => {
    startedRef.current = false;
    ensureLoaded();
  }, [ensureLoaded]);

  return (
    <PresetsContext.Provider value={{ ...state, ensureLoaded, reload }}>
      {children}
    </PresetsContext.Provider>
  );
}

export function usePresets(): PresetsContextValue {
  return useContext(PresetsContext);
}
