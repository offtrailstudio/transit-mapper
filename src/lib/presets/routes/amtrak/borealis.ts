import { LegacyPresetRoute } from "../../legacy";

export const borealis: LegacyPresetRoute = {
  id: "amtrak-borealis",
  name: "Borealis",
  groupId: "amtrak",
  description: "Amtrak · Chicago – St. Paul",
  stops: [
    { name: "Chicago Union Station", lng: -87.6403, lat: 41.8787 },
    { name: "Glenview Station", lng: -87.8057, lat: 42.0751 },
    { name: "Sturtevant Station", lng: -87.9062, lat: 42.7183 },
    { name: "Milwaukee Airport Railroad Station", lng: -87.9247, lat: 42.9406 },
    { name: "Milwaukee Intermodal Station", lng: -87.9172, lat: 43.0342 },
    { name: "Columbus Station, WI", lng: -89.0126, lat: 43.3408 },
    { name: "Portage Station, WI", lng: -89.4677, lat: 43.5471 },
    { name: "Wisconsin Dells Station", lng: -89.7775, lat: 43.6266 },
    { name: "Tomah Station, WI", lng: -90.5055, lat: 43.986 },
    { name: "La Crosse Station, WI", lng: -91.2472, lat: 43.8334 },
    { name: "Winona Station, MN", lng: -91.6401, lat: 44.0443 },
    { name: "Red Wing Station, MN", lng: -92.5372, lat: 44.5664 },
    { name: "Saint Paul Union Depot", lng: -93.0861, lat: 44.9478 },
  ],
};
