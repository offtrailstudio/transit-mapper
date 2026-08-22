import { RouteNetwork } from "./types";

export const BUNDLED_NETWORKS: RouteNetwork[] = [
  {
    id: "amtrak",
    name: "Amtrak",
    description: "U.S. intercity passenger rail",
    defaultRouteType: "rail",
  },
  {
    id: "metro-north",
    name: "Metro-North Railroad",
    description: "New York metropolitan-area commuter rail",
    defaultRouteType: "rail",
  },
  {
    id: "ucat",
    name: "Ulster County Area Transit",
    description: "Kingston-area buses across Ulster County, NY",
    defaultRouteType: "bus",
  },
  {
    id: "dutchess-county",
    name: "Dutchess County Public Transit",
    description: "Hudson Valley, NY bus service",
    defaultRouteType: "bus",
  },
];
