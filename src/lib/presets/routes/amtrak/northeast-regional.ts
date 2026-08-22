import { LegacyPresetRoute } from "../../legacy";

export const northeastRegional: LegacyPresetRoute = {
  id: "amtrak-northeast-regional",
  name: "Northeast Regional",
  color: "#DE1F26",
  groupId: "amtrak",
  description: "Amtrak · Boston – Washington, DC",
  stops: [
    { name: "Boston South Station", lng: -71.0552, lat: 42.3519 },
    { name: "Back Bay", lng: -71.0757, lat: 42.3474 },
    { name: "Providence", lng: -71.4128, lat: 41.8296 },
    { name: "New Haven", lng: -72.9298, lat: 41.2967 },
    { name: "Stamford", lng: -73.5443, lat: 41.0468 },
    { name: "New York Penn Station", lng: -73.9939, lat: 40.7506 },
    { name: "Newark Penn Station", lng: -74.1645, lat: 40.7342 },
    { name: "Trenton", lng: -74.7566, lat: 40.2172 },
    { name: "Philadelphia 30th Street", lng: -75.1822, lat: 39.9566 },
    { name: "Wilmington", lng: -75.5544, lat: 39.7367 },
    { name: "Baltimore Penn Station", lng: -76.6156, lat: 39.3079 },
    { name: "BWI Airport", lng: -76.6822, lat: 39.1954 },
    { name: "Washington Union Station", lng: -77.0068, lat: 38.8973 },
  ],
};
