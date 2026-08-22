import { LegacyPresetRoute } from "../../legacy";

export const newCanaanBranch: LegacyPresetRoute = {
  id: "mnr-new-canaan-branch",
  name: "New Canaan Branch",
  color: "#EE0034",
  groupId: "metro-north",
  description: "Metro-North · Stamford – New Canaan",
  stops: [
    { name: "Stamford", lng: -73.5423, lat: 41.0466 },
    { name: "Glenbrook", lng: -73.5257, lat: 41.0631 },
    { name: "Springdale", lng: -73.5222, lat: 41.0823 },
    { name: "Talmadge Hill", lng: -73.5069, lat: 41.1187 },
    { name: "New Canaan", lng: -73.4954, lat: 41.1462 },
  ],
};
