import { LegacyPresetRoute } from "../../legacy";

export const hiawatha: LegacyPresetRoute = {
  id: "amtrak-hiawatha",
  name: "Hiawatha",
  groupId: "amtrak",
  description: "Amtrak · Chicago – Milwaukee",
  stops: [
    { name: "Chicago Union Station", lng: -87.6403, lat: 41.8787 },
    { name: "Glenview Station", lng: -87.8057, lat: 42.0751 },
    { name: "Sturtevant Station", lng: -87.9062, lat: 42.7183 },
    { name: "Milwaukee Airport Railroad Station", lng: -87.9247, lat: 42.9406 },
    { name: "Milwaukee Intermodal Station", lng: -87.9172, lat: 43.0342 },
  ],
};
