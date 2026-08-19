import { PresetRoute } from "../../types";

export const yellowRoute: PresetRoute = {
  id: "ucat-yellow-route",
  name: "Yellow Route",
  color: "#F5B301",
  routeType: "bus",
  groupId: "ucat",
  description: "UCAT · Kingston Stockade & midtown circulator",
  stops: [
    { name: "Development Court", lng: -74.0035, lat: 41.9366 },
    { name: "Stockade District", lng: -74.019, lat: 41.9348 },
    { name: "Kingston High School", lng: -74.008, lat: 41.928 },
    { name: "Kingston Plaza", lng: -73.9976, lat: 41.933 },
    { name: "Academy Green", lng: -73.9975, lat: 41.9298 },
  ],
};
