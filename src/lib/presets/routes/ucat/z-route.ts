import { LegacyRoute } from "../../legacy";

export const zRoute: LegacyRoute = {
  id: "ucat-z-route",
  name: "Z Route",
  color: "#5B8C2A",
  routeType: "bus",
  groupId: "ucat",
  description: "UCAT · Kingston – Belleayre via NY-28",
  stops: [
    { name: "Development Court", lng: -74.0035, lat: 41.9366 },
    { name: "Kingston Plaza", lng: -73.9976, lat: 41.933 },
    { name: "Boiceville", lng: -74.266, lat: 41.976 },
    { name: "Mount Tremper", lng: -74.283, lat: 42.049 },
    { name: "Phoenicia", lng: -74.316, lat: 42.083 },
    { name: "Pine Hill", lng: -74.487, lat: 42.128 },
    { name: "Belleayre Mountain", lng: -74.506, lat: 42.133 },
  ],
};
