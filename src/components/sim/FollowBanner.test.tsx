import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SharedMapProvider } from "../../context/MapDataContext";
import { SimModeProvider, useSimMode } from "../../context/SimModeContext";
import { buildFollowTimeline, followDwellSeconds } from "../../lib/followAlong";
import { buildRouteScheduleFor } from "../../lib/simulation";
import { TransitMapData } from "../../lib/types";
import { FollowBanner } from "./FollowBanner";

const DATA: TransitMapData = {
  version: 3,
  title: "Test",
  stops: [
    { id: "a", name: "Ashby", lng: 0, lat: 0 },
    { id: "b", name: "Berkeley", lng: 0.05, lat: 0 },
    { id: "c", name: "Concord", lng: 0.1, lat: 0 },
  ],
  routes: [
    {
      id: "red",
      name: "Red Line",
      routeColor: "#f00",
      patterns: [{ id: "red-p", stopIds: ["a", "b", "c"] }],
    },
  ],
};

// The dwell is scaled by the playback speed, so the harness pins the multiplier
// and the fixture timeline is built at that same speed — otherwise these seek
// offsets would land in the wrong phase of the run.
const TEST_MULTIPLIER = 5;
const TIMELINE = buildFollowTimeline(
  buildRouteScheduleFor(DATA, "red")!,
  followDwellSeconds(TEST_MULTIPLIER)
)!;
const MID_FIRST_HOP = (TIMELINE.departures[0] + TIMELINE.arrivals[1]) / 2;

/** Parks the paused clock at `seek` and publishes it, the way a reset would. */
function Harness({ seek }: { seek: number }) {
  const { setViewMode, setFocusRoute, setMultiplier, simSecondsRef, publishFrame } = useSimMode();
  return (
    <div>
      <button
        onClick={() => {
          setMultiplier(TEST_MULTIPLIER);
          setFocusRoute("red");
          setViewMode("follow");
        }}
      >
        start
      </button>
      <button
        onClick={() => {
          simSecondsRef.current = seek;
          publishFrame();
        }}
      >
        seek
      </button>
      <FollowBanner />
    </div>
  );
}

function renderBanner(seek: number) {
  render(
    <SharedMapProvider id="m1" data={DATA}>
      <SimModeProvider>
        <Harness seek={seek} />
      </SimModeProvider>
    </SharedMapProvider>
  );
}

describe("FollowBanner", () => {
  it("shows nothing until a route is being followed", () => {
    renderBanner(0);

    expect(screen.queryByText("Now at")).not.toBeInTheDocument();
  });

  it("opens holding at the origin, naming the stop", async () => {
    renderBanner(0);
    await userEvent.click(screen.getByText("start"));

    expect(screen.getByText("Now at")).toBeInTheDocument();
    expect(screen.getByText("Ashby")).toBeInTheDocument();
  });

  it("shows the phase as the caption over the stop, with no counter", async () => {
    renderBanner(0);
    await userEvent.click(screen.getByText("start"));

    // The caption line carries the phase; the stop name stands alone beneath it.
    expect(screen.getByText("Now at")).toBeInTheDocument();
    expect(screen.queryByText(/Stop \d+ of \d+/)).not.toBeInTheDocument();
  });

  it("leaves naming the route to the picker beside it", async () => {
    renderBanner(0);
    await userEvent.click(screen.getByText("start"));

    expect(screen.queryByText("Red Line")).not.toBeInTheDocument();
  });

  it("names the stop ahead once the vehicle is moving", async () => {
    renderBanner(MID_FIRST_HOP);
    await userEvent.click(screen.getByText("start"));
    await userEvent.click(screen.getByText("seek"));

    await waitFor(() => expect(screen.getByText("Next stop")).toBeInTheDocument());
    expect(screen.getByText("Berkeley")).toBeInTheDocument();
  });

  it("explains itself instead of riding an invisible line", async () => {
    // Hidden means out of the simulation, so there is no vehicle to follow —
    // without this the camera tracked a lone dot across an empty basemap.
    render(
      <SharedMapProvider id="m1" data={{ ...DATA, routes: [{ ...DATA.routes[0], hidden: true }] }}>
        <SimModeProvider>
          <Harness seek={0} />
        </SimModeProvider>
      </SharedMapProvider>
    );
    await userEvent.click(screen.getByText("start"));

    expect(screen.getByText(/is hidden — show it to follow along/)).toBeInTheDocument();
    expect(screen.queryByText("Now at")).not.toBeInTheDocument();
  });

  it("holds again on arrival at the next stop", async () => {
    renderBanner(TIMELINE.arrivals[1] + 1);
    await userEvent.click(screen.getByText("start"));
    await userEvent.click(screen.getByText("seek"));

    await waitFor(() => expect(screen.getByText("Berkeley")).toBeInTheDocument());
    expect(screen.getByText("Now at")).toBeInTheDocument();
  });
});
