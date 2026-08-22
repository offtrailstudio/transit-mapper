import { LegacyRoute } from "../../legacy";

export const kplRoute: LegacyRoute = {
  id: "ucat-kpl-route",
  name: "KPL Route",
  color: "#C1272D",
  routeType: "bus",
  groupId: "ucat",
  description: "UCAT · Kingston – Poughkeepsie via US-9W",
  stops: [
    { name: "Development Court", lng: -74.0035, lat: 41.9366 },
    { name: "Rondout Waterfront", lng: -73.976, lat: 41.9179 },
    { name: "Port Ewen", lng: -73.982, lat: 41.8975 },
    { name: "Highland", lng: -73.96, lat: 41.7205 },
    { name: "Poughkeepsie Station", lng: -73.9376, lat: 41.7065 },
    { name: "Poughkeepsie Galleria", lng: -73.92, lat: 41.647 },
  ],
};
