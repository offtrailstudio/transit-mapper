import { LegacyPresetRoute } from "../../legacy";

export const dutchessRouteC: LegacyPresetRoute = {
  id: "dcpt-route-c",
  name: "Route C",
  color: "#F7941E",
  groupId: "dutchess-county",
  description: "Dutchess County Public Transit · Poughkeepsie – Tivoli",
  stops: [
    { name: "Poughkeepsie Transit Hub", lng: -73.9245, lat: 41.7057 },
    { name: "Dutchess Community College", lng: -73.8985, lat: 41.7178 },
    { name: "Hyde Park", lng: -73.933, lat: 41.7683 },
    { name: "Staatsburg", lng: -73.9257, lat: 41.8654 },
    { name: "Rhinebeck", lng: -73.9124, lat: 41.927 },
    { name: "Red Hook", lng: -73.8724, lat: 42.002 },
    { name: "Bard College", lng: -73.9088, lat: 42.0206 },
    { name: "Tivoli Post Office", lng: -73.9082, lat: 42.0587 },
  ],
};
