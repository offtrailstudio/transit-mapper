import { PresetRoute } from "../../types";

export const dutchessRouteB: PresetRoute = {
  id: "dcpt-route-b",
  name: "Route B",
  color: "#00A651",
  groupId: "dutchess-county",
  description: "Dutchess County Public Transit · Poughkeepsie – Beacon",
  stops: [
    { name: "Poughkeepsie Train Station", lng: -73.9377, lat: 41.7064 },
    { name: "Poughkeepsie Transit Hub", lng: -73.9245, lat: 41.7057 },
    { name: "Poughkeepsie Galleria", lng: -73.9207, lat: 41.6235 },
    { name: "Wappingers Falls", lng: -73.9107, lat: 41.5951 },
    { name: "Beacon Post Office", lng: -73.97, lat: 41.5046 },
    { name: "Beacon Train Station", lng: -73.9873, lat: 41.5043 },
  ],
};
