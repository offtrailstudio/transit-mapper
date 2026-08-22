import { LegacyRoute } from "../../legacy";

export const portEwenLoop: LegacyRoute = {
  id: "ucat-port-ewen-loop",
  name: "Port Ewen Loop",
  color: "#8C6239",
  routeType: "bus",
  groupId: "ucat",
  description: "UCAT · Kingston – Port Ewen via Broadway & US-9W",
  stops: [
    { name: "Development Court", lng: -74.0035, lat: 41.9366 },
    { name: "Academy Green", lng: -73.9975, lat: 41.9298 },
    { name: "Rondout Waterfront", lng: -73.976, lat: 41.9179 },
    { name: "Connelly", lng: -73.976, lat: 41.908 },
    { name: "Port Ewen", lng: -73.982, lat: 41.8975 },
  ],
};
