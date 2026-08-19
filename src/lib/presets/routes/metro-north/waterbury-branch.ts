import { PresetRoute } from "../../types";

export const waterburyBranch: PresetRoute = {
  id: "mnr-waterbury-branch",
  name: "Waterbury Branch",
  color: "#EE0034",
  groupId: "metro-north",
  description: "Metro-North · Bridgeport – Waterbury",
  stops: [
    { name: "Bridgeport", lng: -73.1874, lat: 41.1792 },
    { name: "Derby-Shelton", lng: -73.089, lat: 41.3212 },
    { name: "Ansonia", lng: -73.0787, lat: 41.3437 },
    { name: "Seymour", lng: -73.0761, lat: 41.396 },
    { name: "Beacon Falls", lng: -73.0629, lat: 41.4416 },
    { name: "Naugatuck", lng: -73.0507, lat: 41.4862 },
    { name: "Waterbury", lng: -73.0387, lat: 41.5535 },
  ],
};
