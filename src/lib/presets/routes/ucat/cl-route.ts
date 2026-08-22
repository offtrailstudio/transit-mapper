import { LegacyRoute } from "../../legacy";

export const clRoute: LegacyRoute = {
  id: "ucat-cl-route",
  name: "CL Route",
  color: "#7A3FA0",
  routeType: "bus",
  groupId: "ucat",
  description: "UCAT · Kingston – SUNY New Paltz via SUNY Ulster",
  stops: [
    { name: "Development Court", lng: -74.0035, lat: 41.9366 },
    { name: "Kingston Plaza", lng: -73.9976, lat: 41.933 },
    { name: "SUNY Ulster (Stone Ridge)", lng: -74.136, lat: 41.856 },
    { name: "Rosendale", lng: -74.0785, lat: 41.843 },
    { name: "New Paltz Main Street", lng: -74.087, lat: 41.747 },
    { name: "SUNY New Paltz", lng: -74.0857, lat: 41.7405 },
  ],
};
