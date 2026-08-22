"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Host-supplied configuration for the embeddable editor.
 *
 * The editor never reads `process.env` itself — a package can't know the host's
 * env-var names — so anything environment-specific (today just the Mapbox token)
 * is injected here. The app's `layout.tsx` reads its env and passes it in; an
 * external embedder passes its own token the same way.
 */
export type EditorConfig = {
  mapboxToken?: string;
  /**
   * Which built-in preset networks appear in the "Add a preset route" modal,
   * by group id (e.g. `["amtrak"]` to offer only Amtrak). Omit to show every
   * shipped network. An empty array shows none. Group ids come from
   * `BUNDLED_NETWORKS`.
   */
  presetGroups?: string[];
  /**
   * Enable the "paste a GTFS feed URL" control in the preset modal — lets users
   * import routes from any GTFS `.zip` at runtime. **Off by default** because it
   * lazy-loads the GTFS parser, which requires the host to have installed the
   * optional peer deps `fflate` and `csv-parse`. Turn it on only after adding
   * those, or the control will error when used.
   */
  enableFeedImport?: boolean;
};

const ConfigContext = createContext<EditorConfig>({});

export function EditorConfigProvider({
  config,
  children,
}: {
  config: EditorConfig;
  children: ReactNode;
}) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useEditorConfig(): EditorConfig {
  return useContext(ConfigContext);
}
