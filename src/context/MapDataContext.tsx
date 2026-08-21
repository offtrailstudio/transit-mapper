"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { Action, EditorState, initialEditorState } from "../lib/reducer";
import { HistoryState, historyReducer, initialHistoryState } from "../lib/history";
import { normalizeMapData } from "../lib/migrate";
import {
  createProject,
  ProjectsFile,
  projectForkedFrom,
  projectsFileFromSingleMap,
  projectsFileReducer,
  projectUpdatedAt,
  removeProject,
} from "../lib/projects";
import { CloudMap } from "../lib/cloudSync";
import { EMPTY_MAP_DATA, TransitMapData } from "../lib/types";
import { PresetSource } from "../lib/presets";
import { PresetsProvider } from "./PresetsContext";

export type ProjectSummary = { id: string; title: string; data: TransitMapData };

/**
 * The side-effects the editor delegates to its host, so the package stays
 * embeddable: cloud persistence for the active map and deletes. The app injects
 * Supabase via `useCloudSync` (see `AppMapDataProvider`); the default is a no-op,
 * so a bare embed neither reads nor writes any cloud.
 */
export type CloudSyncHandle = {
  deleteFromCloud: (id: string) => void;
  saveMap: (map: CloudMap) => Promise<void>;
};

export type UseCloudSync = (args: {
  projectsFile: ProjectsFile;
  applyReconciled: (file: ProjectsFile) => void;
}) => CloudSyncHandle;

const useNoCloudSync: UseCloudSync = () => ({
  deleteFromCloud: () => {},
  saveMap: async () => {},
});

type MapDataContextValue = {
  state: EditorState;
  dispatch: React.Dispatch<Action>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  projects: ProjectSummary[];
  activeProjectId: string;
  /** True once localStorage has loaded — before this, `projects` is a placeholder, so route sync must wait. */
  hydrated: boolean;
  /**
   * True when the map is being *viewed*, not edited (the shared `/maps/[id]` view
   * a non-owner sees). Editing affordances read this to hide themselves; the data
   * lives in memory and is never persisted. See `SharedMapProvider`.
   */
  readOnly: boolean;
  switchProject: (id: string) => void;
  /**
   * Creates a project and returns its id so callers can deep-link to `/maps/<id>`.
   * `forkedFrom` records fork lineage — pass it ONLY when copying a cloud map
   * (a shared/public one), so the `forked_from` FK is always satisfiable.
   */
  newProject: (data?: TransitMapData, forkedFrom?: string) => string;
  deleteProject: (id: string) => void;
  /** Save the active map to the cloud now (no-op when signed out). */
  saveActiveMap: () => Promise<void>;
};

const MapDataContext = createContext<MapDataContextValue | null>(null);

function isEditableElement(el: Element | null): boolean {
  if (!el) {
    return false;
  }
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

export function MapDataProvider({
  children,
  loadInitial,
  persist,
  useSync = useNoCloudSync,
  presets,
}: {
  children: React.ReactNode;
  /**
   * Produce the initial projects file (the app passes `loadProjects`, which reads
   * localStorage). Default: one empty in-memory map — a bare embed persists
   * nothing. Read once at mount, so its identity needn't be stable.
   */
  loadInitial?: () => ProjectsFile;
  /** Persist the projects file after every change (the app passes `saveProjects`). Default: nothing. */
  persist?: (file: ProjectsFile) => void;
  /**
   * Cloud-sync hook (the app passes `useCloudSync`). Default: no-op. Called
   * unconditionally every render, so any implementation must obey the rules of hooks.
   */
  useSync?: UseCloudSync;
  /**
   * The preset-route catalog for the "Add a preset route" picker: an object, or a
   * (possibly async) loader fetched lazily on first open. Default: the catalog
   * bundled with the package. Serve your own (see `createRemotePresetLoader`) so
   * adding networks or nudging stops doesn't require a package release.
   */
  presets?: PresetSource;
}) {
  const [history, dispatch] = useReducer(historyReducer, initialHistoryState);
  const state = history.present;

  // Read once at mount; the ref keeps the mount effect off the prop's identity.
  const loadInitialRef = useRef(loadInitial);

  const [projectsFile, dispatchProjectsFile] = useReducer(
    projectsFileReducer,
    undefined,
    projectsFileFromSingleMap
  );
  // Guards the two effects below from running against pre-hydration placeholder
  // state before the mount-time load effect (declared last, so it runs after them
  // in the same pass) has a chance to populate real data.
  const hasHydratedRef = useRef(false);
  // A rendered mirror of the ref above: the ref guards effects synchronously,
  // but consumers (e.g. the `/maps/[id]` route sync) need a re-render once the
  // real projects have loaded so they don't act on placeholder state. A one-way
  // reducer (never back to false) rather than useState, so it can be flipped
  // from the mount effect the same way the file/editor dispatches are.
  const [hydrated, markHydrated] = useReducer(() => true, false);

  // Keep the active project's stored data in sync with every edit.
  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }
    dispatchProjectsFile({ type: "MERGE_ACTIVE_DATA", data: state.data });
  }, [state.data]);

  // Persist whenever the projects file changes (edits, switches, creates, deletes).
  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }
    persist?.(projectsFile);
  }, [projectsFile, persist]);

  // Load persisted data once, on mount (client-only — localStorage isn't available during SSR).
  useEffect(() => {
    const loaded = loadInitialRef.current?.() ?? projectsFileFromSingleMap();
    hasHydratedRef.current = true;
    markHydrated();
    dispatchProjectsFile({ type: "SET", file: loaded });
    dispatch({ type: "LOAD", data: loaded.projects[loaded.activeProjectId] ?? EMPTY_MAP_DATA });
  }, []);

  // Cloud sync (no-op unless signed in): reconcile local ↔ cloud on sign-in and
  // autosave the active map. Replaces the whole file with the reconciled set and
  // reloads the active map into the editor.
  const applyReconciled = useCallback((file: ProjectsFile) => {
    dispatchProjectsFile({ type: "SET", file });
    dispatch({ type: "LOAD", data: file.projects[file.activeProjectId] ?? EMPTY_MAP_DATA });
  }, []);
  const { deleteFromCloud, saveMap } = useSync({ projectsFile, applyReconciled });

  // Save the live active map (state.data, not the one-keystroke-stale stored copy).
  const saveActiveMap = useCallback(async () => {
    const activeId = projectsFile.activeProjectId;
    await saveMap({
      id: activeId,
      name: state.data.title || "Untitled Map",
      data: state.data,
      updatedAt: projectUpdatedAt(projectsFile, activeId),
      forkedFrom: projectForkedFrom(projectsFile, activeId),
    });
  }, [saveMap, projectsFile, state.data]);

  const switchProject = useCallback(
    (id: string) => {
      if (id === projectsFile.activeProjectId) {
        return;
      }
      const data = projectsFile.projects[id];
      if (!data) {
        return;
      }
      dispatchProjectsFile({ type: "SET", file: { ...projectsFile, activeProjectId: id } });
      dispatch({ type: "LOAD", data });
    },
    [projectsFile]
  );

  const newProject = useCallback(
    (data: TransitMapData = EMPTY_MAP_DATA, forkedFrom?: string): string => {
      const { file, newId } = createProject(projectsFile, data, forkedFrom);
      dispatchProjectsFile({ type: "SET", file });
      dispatch({ type: "LOAD", data: file.projects[newId] });
      return newId;
    },
    [projectsFile]
  );

  const deleteProject = useCallback(
    (id: string) => {
      deleteFromCloud(id);
      const next = removeProject(projectsFile, id);
      dispatchProjectsFile({ type: "SET", file: next });
      if (next.activeProjectId !== projectsFile.activeProjectId) {
        dispatch({ type: "LOAD", data: next.projects[next.activeProjectId] });
      }
    },
    [projectsFile, deleteFromCloud]
  );

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") {
        return;
      }
      if (isEditableElement(document.activeElement)) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // The active project reads from `state.data` rather than the stored copy: edits
  // land in the reducer first and only reach `projectsFile` a render later, so the
  // stored copy would lag by one keystroke in the gallery's titles and previews.
  const projects: ProjectSummary[] = projectsFile.projectOrder.map((id) => {
    const data =
      id === projectsFile.activeProjectId
        ? state.data
        : projectsFile.projects[id] ?? EMPTY_MAP_DATA;
    return { id, title: data.title || "Untitled Map", data };
  });

  return (
    <MapDataContext.Provider
      value={{
        state,
        dispatch,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        undo,
        redo,
        projects,
        activeProjectId: projectsFile.activeProjectId,
        hydrated,
        readOnly: false,
        switchProject,
        newProject,
        deleteProject,
        saveActiveMap,
      }}
    >
      <PresetsProvider source={presets}>{children}</PresetsProvider>
    </MapDataContext.Provider>
  );
}

/**
 * Supplies a map to the read-only shared view (`/maps/[id]` for a non-owner).
 * The data is held in an in-memory history reducer seeded from the shared row and
 * is never written to localStorage or the cloud — a visitor can browse routes,
 * expand them, toggle visibility, and run the simulation without touching their
 * own maps. Editing dispatches never reach it because the UI hides them under
 * `readOnly`; the ones that remain (route expand, visibility) are transient view
 * state, so mutating the in-memory copy is harmless.
 *
 * `newProject` deliberately delegates to the outer (real) provider so "Duplicate
 * to edit" forks the map into a fresh id in the *visitor's* own storage, at which
 * point they become its owner and get the full editor.
 */
export function SharedMapProvider({
  id,
  data,
  children,
}: {
  id: string;
  data: TransitMapData;
  children: React.ReactNode;
}) {
  const outer = useContext(MapDataContext);
  const [history, dispatch] = useReducer(
    historyReducer,
    data,
    (seed): HistoryState => ({
      past: [],
      present: { ...initialEditorState, data: normalizeMapData(seed) },
      future: [],
    })
  );

  const outerNewProject = outer?.newProject;
  const newProject = useCallback(
    (next: TransitMapData = data, forkedFrom?: string): string => {
      if (!outerNewProject) {
        throw new Error("SharedMapProvider must be mounted inside MapDataProvider");
      }
      return outerNewProject(next, forkedFrom);
    },
    [outerNewProject, data]
  );

  const value = useMemo<MapDataContextValue>(
    () => ({
      state: history.present,
      dispatch,
      canUndo: false,
      canRedo: false,
      undo: () => {},
      redo: () => {},
      projects: outer?.projects ?? [],
      activeProjectId: id,
      hydrated: true,
      readOnly: true,
      switchProject: () => {},
      newProject,
      deleteProject: () => {},
      saveActiveMap: async () => {},
    }),
    [history.present, outer?.projects, id, newProject]
  );

  return <MapDataContext.Provider value={value}>{children}</MapDataContext.Provider>;
}

export function useMapData(): MapDataContextValue {
  const context = useContext(MapDataContext);
  if (!context) {
    throw new Error("useMapData must be used within a MapDataProvider");
  }
  return context;
}
