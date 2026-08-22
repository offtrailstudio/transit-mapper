import { LegacyPresetRoute } from "../../legacy";

export const pereMarquette: LegacyPresetRoute = {
  id: "amtrak-pere-marquette",
  name: "Pere Marquette",
  groupId: "amtrak",
  description: "Amtrak · Chicago – Grand Rapids",
  stops: [
    { name: "Chicago Union Station", lng: -87.6403, lat: 41.8787 },
    { name: "St. Joseph-Benton Harbor, MI", lng: -86.4867, lat: 42.1068 },
    { name: "Bangor, MI", lng: -86.1117, lat: 42.3142 },
    { name: "Holland (Padnos Transportation Center)", lng: -86.098, lat: 42.7894 },
    { name: "Grand Rapids (Vernon J. Ehlers Station)", lng: -85.6722, lat: 42.9556 },
  ],
};
