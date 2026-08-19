import { PresetRoute } from "../../types";

export const uplRoute: PresetRoute = {
  id: "ucat-upl-route",
  name: "UPL Route",
  color: "#2A9D3A",
  routeType: "bus",
  groupId: "ucat",
  description: "UCAT · New Paltz – Poughkeepsie via NY-299",
  stops: [
    { name: "SUNY New Paltz", lng: -74.0857, lat: 41.7405 },
    { name: "New Paltz Main Street", lng: -74.087, lat: 41.747 },
    { name: "New Paltz Park & Ride", lng: -74.079, lat: 41.748 },
    { name: "Highland", lng: -73.96, lat: 41.7205 },
    { name: "Poughkeepsie Station", lng: -73.9376, lat: 41.7065 },
    { name: "Poughkeepsie Galleria", lng: -73.92, lat: 41.647 },
  ],
};
