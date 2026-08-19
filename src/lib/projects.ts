import { normalizeMapData } from "./migrate";
import { loadMap } from "./storage";
import { EMPTY_MAP_DATA, TransitMapData } from "./types";

export const PROJECTS_STORAGE_KEY = "transit-map:projects:v1";

export type ProjectsFile = {
  activeProjectId: string;
  projectOrder: string[];
  projects: Record<string, TransitMapData>;
  /**
   * Per-project last-edit time (epoch ms), used for cloud last-write-wins.
   * Optional so pre-cloud stored files still parse; read via `projectUpdatedAt`.
   */
  updatedAt?: Record<string, number>;
  /**
   * Per-project fork lineage: the cloud id this map was copied from. Only set
   * when forking a *cloud* map (a shared/public one that exists in the `maps`
   * table), so the `forked_from` FK is always satisfiable. Read via
   * `projectForkedFrom`; mirrors the `maps.forked_from` column.
   */
  forkedFrom?: Record<string, string>;
};

function createId(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

/** A project's last-edit time in epoch ms, or 0 if never stamped. */
export function projectUpdatedAt(file: ProjectsFile, id: string): number {
  return file.updatedAt?.[id] ?? 0;
}

/** The cloud id this project was forked from, or null if it's an original. */
export function projectForkedFrom(file: ProjectsFile, id: string): string | null {
  return file.forkedFrom?.[id] ?? null;
}

/** Pure parse/validate step, kept separate from localStorage access so it's easy to unit test. */
export function parseProjectsFile(json: string | null): ProjectsFile | null {
  if (!json) {
    return null;
  }
  try {
    const parsed = JSON.parse(json);
    const isValid =
      parsed &&
      typeof parsed.activeProjectId === "string" &&
      Array.isArray(parsed.projectOrder) &&
      parsed.projects &&
      typeof parsed.projects === "object" &&
      !Array.isArray(parsed.projects);
    return isValid ? (parsed as ProjectsFile) : null;
  } catch {
    return null;
  }
}

/** Wraps a single map as the sole project — used for a brand-new session and to migrate legacy single-map storage. */
export function projectsFileFromSingleMap(data: TransitMapData = EMPTY_MAP_DATA): ProjectsFile {
  const id = createId();
  return { activeProjectId: id, projectOrder: [id], projects: { [id]: data }, updatedAt: { [id]: now() } };
}

/** Backfills simulation params (and any future migrations) across every project in the file. */
function normalizeProjectsFile(file: ProjectsFile): ProjectsFile {
  const projects: Record<string, TransitMapData> = {};
  for (const [id, data] of Object.entries(file.projects)) {
    projects[id] = normalizeMapData(data);
  }
  return { ...file, projects };
}

export function loadProjects(): ProjectsFile {
  if (typeof window === "undefined") {
    return projectsFileFromSingleMap();
  }
  const stored = parseProjectsFile(window.localStorage.getItem(PROJECTS_STORAGE_KEY));
  // Nobody's existing single map should silently disappear just because this key is new.
  return stored ? normalizeProjectsFile(stored) : projectsFileFromSingleMap(normalizeMapData(loadMap()));
}

export function saveProjects(file: ProjectsFile): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(file));
}

export function createProject(
  existing: ProjectsFile,
  data: TransitMapData = EMPTY_MAP_DATA,
  forkedFrom?: string
): { file: ProjectsFile; newId: string } {
  const newId = createId();
  return {
    newId,
    file: {
      activeProjectId: newId,
      projectOrder: [...existing.projectOrder, newId],
      projects: { ...existing.projects, [newId]: data },
      updatedAt: { ...existing.updatedAt, [newId]: now() },
      forkedFrom: forkedFrom
        ? { ...existing.forkedFrom, [newId]: forkedFrom }
        : existing.forkedFrom,
    },
  };
}

/** Removes a project, switching to an adjacent one if the active project was removed, or seeding a fresh empty project if it was the last one. */
export function removeProject(existing: ProjectsFile, id: string): ProjectsFile {
  const index = existing.projectOrder.indexOf(id);
  const projectOrder = existing.projectOrder.filter((projectId) => projectId !== id);
  const projects = { ...existing.projects };
  delete projects[id];
  const updatedAt = { ...existing.updatedAt };
  delete updatedAt[id];
  const forkedFrom = existing.forkedFrom ? { ...existing.forkedFrom } : undefined;
  if (forkedFrom) {
    delete forkedFrom[id];
  }

  if (projectOrder.length === 0) {
    return projectsFileFromSingleMap();
  }

  const activeProjectId =
    existing.activeProjectId === id
      ? projectOrder[Math.min(Math.max(index - 1, 0), projectOrder.length - 1)]
      : existing.activeProjectId;

  return { activeProjectId, projectOrder, projects, updatedAt, forkedFrom };
}

/**
 * Replaces one project's id with a fresh one, keeping its data and position. Used
 * to recover a map whose cloud row is owned by a different account (e.g. left in
 * this browser after switching accounts) — re-minting gives the current user a
 * saveable copy under an id they own. The edit time is bumped so it syncs as a
 * new local map, and any fork lineage is dropped (an own copy isn't a fork). If
 * `oldId` isn't present, the file is returned unchanged.
 */
export function remintProject(existing: ProjectsFile, oldId: string): { file: ProjectsFile; newId: string } {
  const data = existing.projects[oldId];
  if (!data) {
    return { file: existing, newId: oldId };
  }
  const newId = createId();
  const projects = { ...existing.projects, [newId]: data };
  delete projects[oldId];
  const projectOrder = existing.projectOrder.map((id) => (id === oldId ? newId : id));
  const updatedAt = { ...existing.updatedAt, [newId]: now() };
  delete updatedAt[oldId];
  const forkedFrom = existing.forkedFrom ? { ...existing.forkedFrom } : undefined;
  if (forkedFrom) {
    delete forkedFrom[oldId];
  }
  const activeProjectId = existing.activeProjectId === oldId ? newId : existing.activeProjectId;
  return { file: { activeProjectId, projectOrder, projects, updatedAt, forkedFrom }, newId };
}

export function setProjectData(existing: ProjectsFile, id: string, data: TransitMapData): ProjectsFile {
  return { ...existing, projects: { ...existing.projects, [id]: data } };
}

export type ProjectsFileAction =
  | { type: "SET"; file: ProjectsFile }
  | { type: "MERGE_ACTIVE_DATA"; data: TransitMapData; at?: number };

export function projectsFileReducer(state: ProjectsFile, action: ProjectsFileAction): ProjectsFile {
  switch (action.type) {
    case "SET":
      return action.file;
    case "MERGE_ACTIVE_DATA": {
      const merged = setProjectData(state, state.activeProjectId, action.data);
      // Stamp the active project's edit time so cloud sync can last-write-wins.
      return {
        ...merged,
        updatedAt: { ...state.updatedAt, [state.activeProjectId]: action.at ?? now() },
      };
    }
    default:
      return state;
  }
}
