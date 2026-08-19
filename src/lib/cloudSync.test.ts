import { describe, expect, it } from "vitest";
import { CloudMap, reconcileMaps } from "./cloudSync";
import { EMPTY_MAP_DATA, TransitMapData } from "./types";

function map(id: string, updatedAt: number, title = id): CloudMap {
  const data: TransitMapData = { ...EMPTY_MAP_DATA, title };
  return { id, name: title, data, updatedAt };
}

describe("reconcileMaps", () => {
  it("pushes local-only maps to the cloud (the signed-out → signed-up migration)", () => {
    const local = [map("a", 100), map("b", 200)];
    const plan = reconcileMaps(local, []);
    expect(plan.push).toEqual(local);
    expect(plan.pull).toEqual([]);
    expect(plan.merged).toEqual(local);
  });

  it("pulls cloud-only maps into local state", () => {
    const remote = [map("x", 100), map("y", 200)];
    const plan = reconcileMaps([], remote);
    expect(plan.pull).toEqual(remote);
    expect(plan.push).toEqual([]);
    expect(plan.merged).toEqual(remote);
  });

  it("keeps the local copy and pushes it when local is newer", () => {
    const localNewer = map("a", 300, "local");
    const remoteOlder = map("a", 100, "remote");
    const plan = reconcileMaps([localNewer], [remoteOlder]);
    expect(plan.push).toEqual([localNewer]);
    expect(plan.pull).toEqual([]);
    expect(plan.merged).toEqual([localNewer]);
  });

  it("takes the cloud copy and pulls it when cloud is newer", () => {
    const localOlder = map("a", 100, "local");
    const remoteNewer = map("a", 300, "remote");
    const plan = reconcileMaps([localOlder], [remoteNewer]);
    expect(plan.pull).toEqual([remoteNewer]);
    expect(plan.push).toEqual([]);
    expect(plan.merged).toEqual([remoteNewer]);
  });

  it("is a no-op for a map that agrees on both sides (equal timestamps)", () => {
    const local = map("a", 200, "local");
    const remote = map("a", 200, "remote");
    const plan = reconcileMaps([local], [remote]);
    expect(plan.push).toEqual([]);
    expect(plan.pull).toEqual([]);
    // Equal timestamps keep the local copy rather than churning it.
    expect(plan.merged).toEqual([local]);
  });

  it("handles a mixed set: some newer local, some newer cloud, some unique to each", () => {
    const local = [
      map("shared-local-wins", 300, "L"),
      map("shared-cloud-wins", 100, "L"),
      map("local-only", 150, "L"),
    ];
    const remote = [
      map("shared-local-wins", 100, "R"),
      map("shared-cloud-wins", 300, "R"),
      map("cloud-only", 150, "R"),
    ];
    const plan = reconcileMaps(local, remote);

    expect(plan.push.map((m) => m.id)).toEqual(["shared-local-wins", "local-only"]);
    expect(plan.pull.map((m) => m.id)).toEqual(["shared-cloud-wins", "cloud-only"]);
    // Local order first, then cloud-only appended.
    expect(plan.merged.map((m) => m.id)).toEqual([
      "shared-local-wins",
      "shared-cloud-wins",
      "local-only",
      "cloud-only",
    ]);
    // The winning side's actual content is carried through, not just the id.
    expect(plan.merged.find((m) => m.id === "shared-cloud-wins")?.name).toBe("R");
    expect(plan.merged.find((m) => m.id === "shared-local-wins")?.name).toBe("L");
  });

  it("returns an empty plan for two empty sets", () => {
    expect(reconcileMaps([], [])).toEqual({ push: [], pull: [], merged: [] });
  });

  it("preserves local gallery order in the merged set", () => {
    const local = [map("c", 10), map("a", 10), map("b", 10)];
    const plan = reconcileMaps(local, []);
    expect(plan.merged.map((m) => m.id)).toEqual(["c", "a", "b"]);
  });
});
