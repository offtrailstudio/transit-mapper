import { PresetRoute } from "../../types";

export const lincolnService: PresetRoute = {
  id: "amtrak-lincoln-service",
  name: "Lincoln Service",
  groupId: "amtrak",
  description: "Amtrak · Chicago – St. Louis",
  stops: [
    { name: "Chicago Union Station", lng: -87.6403, lat: 41.8787 },
    { name: "Summit, IL", lng: -87.8168, lat: 41.7761 },
    { name: "Joliet Transportation Center", lng: -88.0789, lat: 41.5244 },
    { name: "Dwight, IL", lng: -88.4297, lat: 41.0903 },
    { name: "Pontiac, IL", lng: -88.6369, lat: 40.8786 },
    { name: "Bloomington-Normal, IL", lng: -88.9842, lat: 40.5086 },
    { name: "Lincoln, IL", lng: -89.3635, lat: 40.1475 },
    { name: "Springfield, IL", lng: -89.6515, lat: 39.8023 },
    { name: "Carlinville, IL", lng: -89.8888, lat: 39.2794 },
    { name: "Alton, IL", lng: -90.1572, lat: 38.9211 },
    { name: "Gateway Transportation Center (St. Louis)", lng: -90.2036, lat: 38.6242 },
  ],
};
