import { PresetRoute } from "../../types";

export const dutchessRouteE: PresetRoute = {
  id: "dcpt-route-e",
  name: "Route E",
  color: "#ED1C24",
  groupId: "dutchess-county",
  description: "Dutchess County Public Transit · Poughkeepsie – Pawling – Wingdale",
  stops: [
    { name: "Poughkeepsie Transit Hub", lng: -73.9245, lat: 41.7057 },
    { name: "LaGrangeville", lng: -73.736, lat: 41.664 },
    { name: "Poughquag", lng: -73.6749, lat: 41.6079 },
    { name: "Pawling", lng: -73.6018, lat: 41.5637 },
    { name: "Wingdale", lng: -73.5624, lat: 41.6479 },
  ],
};
