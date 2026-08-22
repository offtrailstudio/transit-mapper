import { LegacyPresetRoute } from "../../legacy";

export const dutchessRouteD: LegacyPresetRoute = {
  id: "dcpt-route-d",
  name: "Route D",
  color: "#92278F",
  groupId: "dutchess-county",
  description: "Dutchess County Public Transit · Poughkeepsie – Millbrook – Wassaic",
  stops: [
    { name: "Poughkeepsie Transit Hub", lng: -73.9245, lat: 41.7057 },
    { name: "Adams Fairacre Farms", lng: -73.881, lat: 41.6929 },
    { name: "Pleasant Valley", lng: -73.8199, lat: 41.744 },
    { name: "Millbrook", lng: -73.6935, lat: 41.7859 },
    { name: "Amenia", lng: -73.554, lat: 41.8468 },
    { name: "Wassaic Train Station", lng: -73.562, lat: 41.8129 },
  ],
};
