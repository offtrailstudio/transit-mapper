import { PresetRoute } from "../../types";

export const blueRoute: PresetRoute = {
  id: "ucat-blue-route",
  name: "Blue Route",
  color: "#2C6FB5",
  routeType: "bus",
  groupId: "ucat",
  description: "UCAT · Uptown Kingston circulator",
  stops: [
    { name: "Development Court", lng: -74.0035, lat: 41.9366 },
    { name: "Kingston Plaza", lng: -73.9976, lat: 41.933 },
    { name: "Academy Green", lng: -73.9975, lat: 41.9298 },
    { name: "Kingston City Hall", lng: -73.9906, lat: 41.9268 },
    { name: "HealthAlliance Hospital", lng: -73.986, lat: 41.9245 },
    { name: "Rondout Waterfront", lng: -73.976, lat: 41.9179 },
  ],
};
