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
