import { LegacyPresetRoute } from "../../legacy";

export const xRoute: LegacyPresetRoute = {
  id: "ucat-x-route",
  name: "X Route",
  color: "#35424A",
  routeType: "bus",
  groupId: "ucat",
  description: "UCAT · Kingston – Newburgh via NY-32",
  stops: [
    { name: "Development Court", lng: -74.0035, lat: 41.9366 },
    { name: "Kingston Plaza", lng: -73.9976, lat: 41.933 },
    { name: "New Paltz Main Street", lng: -74.087, lat: 41.747 },
    { name: "Wallkill", lng: -74.183, lat: 41.61 },
    { name: "Newburgh Mall", lng: -74.079, lat: 41.539 },
  ],
};
