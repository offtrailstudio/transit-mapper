import { PresetRoute } from "../../types";

export const euRoute: PresetRoute = {
  id: "ucat-eu-route",
  name: "EU Route",
  color: "#E4572E",
  routeType: "bus",
  groupId: "ucat",
  description: "UCAT · Kingston – Ellenville via US-209",
  stops: [
    { name: "Development Court", lng: -74.0035, lat: 41.9366 },
    { name: "Kingston Plaza", lng: -73.9976, lat: 41.933 },
    { name: "SUNY Ulster (Stone Ridge)", lng: -74.136, lat: 41.856 },
    { name: "Accord", lng: -74.23, lat: 41.797 },
    { name: "Kerhonkson", lng: -74.296, lat: 41.772 },
    { name: "Ellenville (Liberty Square)", lng: -74.396, lat: 41.717 },
  ],
};
