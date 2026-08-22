import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MergeStationsModal } from "./MergeStationsModal";
import { StationMergeCandidate } from "../../lib/presetMerge";
import { ResolvedRoute } from "../../lib/presets";

const PRESET: ResolvedRoute = {
  id: "acela",
  name: "Acela",
  stops: [
    { id: "nyp", name: "New York Penn", lng: -73.9939, lat: 40.7506 },
    { id: "was", name: "Washington Union", lng: -77.0068, lat: 38.8973 },
  ],
};

const CANDIDATES: StationMergeCandidate[] = [
  {
    stopIndex: 0,
    stop: PRESET.stops[0],
    existingStop: { id: "ny", name: "NY Penn Station", lng: -73.9939, lat: 40.7506 },
    distanceMeters: 12,
  },
  {
    stopIndex: 1,
    stop: PRESET.stops[1],
    existingStop: { id: "dc", name: "DC Union", lng: -77.0068, lat: 38.8973 },
    distanceMeters: 4,
  },
];

function setup() {
  const onConfirm = vi.fn();
  const onBack = vi.fn();
  render(
    <MergeStationsModal
      open
      preset={PRESET}
      candidates={CANDIDATES}
      onBack={onBack}
      onConfirm={onConfirm}
      onClose={() => {}}
    />
  );
  return { onConfirm, onBack };
}

describe("MergeStationsModal", () => {
  it("shows both the new stop and the existing station it would merge into", () => {
    setup();
    expect(screen.getByText("New York Penn")).toBeInTheDocument();
    expect(screen.getByText("NY Penn Station")).toBeInTheDocument();
    expect(screen.getByText("Washington Union")).toBeInTheDocument();
    expect(screen.getByText("DC Union")).toBeInTheDocument();
  });

  it("pre-selects every shared station", () => {
    setup();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    expect(boxes.every((box) => (box as HTMLInputElement).checked)).toBe(true);
  });

  it("confirms a merge to the existing stop id for every checked stop", async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add route" }));
    expect(onConfirm).toHaveBeenCalledWith({ 0: "ny", 1: "dc" });
  });

  it("drops a stop's merge when its box is unchecked", async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getAllByRole("checkbox")[0]);
    await userEvent.click(screen.getByRole("button", { name: "Add route" }));
    expect(onConfirm).toHaveBeenCalledWith({ 1: "dc" });
  });

  it("confirms an empty merge map when nothing stays checked", async () => {
    const { onConfirm } = setup();
    for (const box of screen.getAllByRole("checkbox")) {
      await userEvent.click(box);
    }
    await userEvent.click(screen.getByRole("button", { name: "Add route" }));
    expect(onConfirm).toHaveBeenCalledWith({});
  });

  it("backs out without confirming", async () => {
    const { onBack, onConfirm } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
