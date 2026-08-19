import { describe, expect, it } from "vitest";
import {
  createProject,
  parseProjectsFile,
  projectForkedFrom,
  projectsFileFromSingleMap,
  projectsFileReducer,
  remintProject,
  removeProject,
  setProjectData,
} from "./projects";
import { EMPTY_MAP_DATA, TransitMapData } from "./types";

const SAMPLE_MAP: TransitMapData = {
  version: 3,
  title: "My Map",
  stops: [{ id: "p1", name: "Station 1", lng: 0, lat: 0 }],
  routes: [],
};

describe("parseProjectsFile", () => {
  it("returns null when there is nothing stored", () => {
    expect(parseProjectsFile(null)).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    expect(parseProjectsFile("{not valid json")).toBeNull();
  });

  it("returns null when the shape is invalid", () => {
    expect(parseProjectsFile(JSON.stringify({ activeProjectId: "a" }))).toBeNull();
  });

  it("returns the parsed file when it's valid", () => {
    const file = { activeProjectId: "a", projectOrder: ["a"], projects: { a: SAMPLE_MAP } };
    expect(parseProjectsFile(JSON.stringify(file))).toEqual(file);
  });
});

describe("projectsFileFromSingleMap", () => {
  it("wraps the given map as the sole project and makes it active", () => {
    const file = projectsFileFromSingleMap(SAMPLE_MAP);
    expect(file.projectOrder).toHaveLength(1);
    expect(file.activeProjectId).toBe(file.projectOrder[0]);
    expect(file.projects[file.activeProjectId]).toEqual(SAMPLE_MAP);
  });

  it("defaults to an empty map when no data is given", () => {
    const file = projectsFileFromSingleMap();
    expect(file.projects[file.activeProjectId]).toEqual(EMPTY_MAP_DATA);
  });
});

describe("createProject", () => {
  it("appends a new project and makes it active", () => {
    const existing = projectsFileFromSingleMap(SAMPLE_MAP);
    const { file, newId } = createProject(existing);

    expect(file.projectOrder).toEqual([...existing.projectOrder, newId]);
    expect(file.activeProjectId).toBe(newId);
    expect(file.projects[newId]).toEqual(EMPTY_MAP_DATA);
    // the original project is untouched
    expect(file.projects[existing.activeProjectId]).toEqual(SAMPLE_MAP);
  });

  it("seeds the new project with the given data", () => {
    const existing = projectsFileFromSingleMap();
    const { file, newId } = createProject(existing, SAMPLE_MAP);
    expect(file.projects[newId]).toEqual(SAMPLE_MAP);
  });

  it("records fork lineage when forkedFrom is given, and none otherwise", () => {
    const existing = projectsFileFromSingleMap(SAMPLE_MAP);
    const original = createProject(existing, SAMPLE_MAP);
    expect(projectForkedFrom(original.file, original.newId)).toBeNull();

    const fork = createProject(existing, SAMPLE_MAP, "parent-id");
    expect(projectForkedFrom(fork.file, fork.newId)).toBe("parent-id");
  });

  it("drops a project's lineage when it's removed", () => {
    const existing = projectsFileFromSingleMap(SAMPLE_MAP);
    const { file, newId } = createProject(existing, SAMPLE_MAP, "parent-id");
    const after = removeProject(file, newId);
    expect(projectForkedFrom(after, newId)).toBeNull();
  });
});

describe("remintProject", () => {
  it("swaps the id, keeps data + position, and drops lineage", () => {
    let file = projectsFileFromSingleMap(SAMPLE_MAP);
    const oldId = file.activeProjectId;
    file = { ...file, forkedFrom: { [oldId]: "parent" } };

    const { file: next, newId } = remintProject(file, oldId);

    expect(newId).not.toBe(oldId);
    expect(next.projects[oldId]).toBeUndefined();
    expect(next.projects[newId]).toEqual(SAMPLE_MAP);
    expect(next.projectOrder).toEqual([newId]);
    expect(next.activeProjectId).toBe(newId); // it was active, so the active id follows
    expect(projectForkedFrom(next, newId)).toBeNull(); // an own copy isn't a fork
  });

  it("leaves the active project alone when a different id is re-minted", () => {
    let file = projectsFileFromSingleMap(SAMPLE_MAP);
    const firstId = file.activeProjectId;
    file = createProject(file, EMPTY_MAP_DATA).file; // a second project becomes active
    const activeId = file.activeProjectId;

    expect(remintProject(file, firstId).file.activeProjectId).toBe(activeId);
  });

  it("returns the file unchanged for an unknown id", () => {
    const file = projectsFileFromSingleMap(SAMPLE_MAP);
    const { file: next, newId } = remintProject(file, "nope");
    expect(next).toBe(file);
    expect(newId).toBe("nope");
  });
});

describe("removeProject", () => {
  it("switches to the previous project when the active one is removed", () => {
    let file = projectsFileFromSingleMap(SAMPLE_MAP);
    const firstId = file.activeProjectId;
    file = createProject(file).file;
    const secondId = file.activeProjectId;
    file = createProject(file).file;
    const thirdId = file.activeProjectId;

    file = removeProject(file, thirdId);

    expect(file.projectOrder).toEqual([firstId, secondId]);
    expect(file.activeProjectId).toBe(secondId);
  });

  it("switches to the next project when the first (active) project is removed", () => {
    let file = projectsFileFromSingleMap(SAMPLE_MAP);
    const firstId = file.activeProjectId;
    file = createProject(file).file;
    const secondId = file.activeProjectId;

    file = removeProject(file, firstId);

    expect(file.projectOrder).toEqual([secondId]);
    expect(file.activeProjectId).toBe(secondId);
  });

  it("leaves the active project untouched when removing an inactive one", () => {
    let file = projectsFileFromSingleMap(SAMPLE_MAP);
    const firstId = file.activeProjectId;
    file = createProject(file).file;
    const secondId = file.activeProjectId;

    file = removeProject(file, firstId);

    expect(file.activeProjectId).toBe(secondId);
    expect(file.projects[firstId]).toBeUndefined();
  });

  it("replaces the last remaining project with a fresh empty one instead of leaving zero", () => {
    const file = projectsFileFromSingleMap(SAMPLE_MAP);
    const result = removeProject(file, file.activeProjectId);

    expect(result.projectOrder).toHaveLength(1);
    expect(result.projects[result.activeProjectId]).toEqual(EMPTY_MAP_DATA);
  });
});

describe("setProjectData", () => {
  it("updates only the target project's data", () => {
    let file = projectsFileFromSingleMap(SAMPLE_MAP);
    const firstId = file.activeProjectId;
    const secondMap: TransitMapData = { ...EMPTY_MAP_DATA, title: "Second Map" };
    file = createProject(file, secondMap).file;
    const secondId = file.activeProjectId;

    file = setProjectData(file, firstId, EMPTY_MAP_DATA);

    expect(file.projects[firstId]).toEqual(EMPTY_MAP_DATA);
    expect(file.projects[secondId]).toEqual(secondMap);
  });
});

describe("projectsFileReducer", () => {
  it("SET replaces the whole file", () => {
    const file = projectsFileFromSingleMap(SAMPLE_MAP);
    const replacement = projectsFileFromSingleMap();
    expect(projectsFileReducer(file, { type: "SET", file: replacement })).toEqual(replacement);
  });

  it("MERGE_ACTIVE_DATA updates only the active project's data", () => {
    const file = projectsFileFromSingleMap(SAMPLE_MAP);
    const result = projectsFileReducer(file, { type: "MERGE_ACTIVE_DATA", data: EMPTY_MAP_DATA });
    expect(result.projects[file.activeProjectId]).toEqual(EMPTY_MAP_DATA);
  });
});
