import { PresetRoute } from "../../types";

export const dutchessRouteA: PresetRoute = {
  id: "dcpt-route-a",
  name: "Route A",
  color: "#0072CE",
  groupId: "dutchess-county",
  description: "Dutchess County Public Transit · Poughkeepsie – Fishkill",
  stops: [
    { name: "Poughkeepsie Train Station", lng: -73.9377, lat: 41.7064 },
    { name: "Poughkeepsie Transit Hub", lng: -73.9245, lat: 41.7057 },
    { name: "Poughkeepsie Galleria", lng: -73.9207, lat: 41.6235 },
    { name: "Wappingers Falls", lng: -73.9107, lat: 41.5951 },
    { name: "Fishkill Walmart", lng: -73.901, lat: 41.5262 },
    { name: "Fishkill Village", lng: -73.8996, lat: 41.5354 },
  ],
};
