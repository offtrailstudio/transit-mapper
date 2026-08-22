import { LegacyRoute } from "../../legacy";

export const downeaster: LegacyRoute = {
  id: "amtrak-downeaster",
  name: "Downeaster",
  groupId: "amtrak",
  description: "Amtrak · Boston – Brunswick, ME",
  stops: [
    { name: "Boston North Station", lng: -71.0605, lat: 42.3661 },
    { name: "Woburn, MA", lng: -71.1631, lat: 42.4954 },
    { name: "Haverhill, MA", lng: -71.0995, lat: 42.7762 },
    { name: "Exeter, NH", lng: -70.9478, lat: 42.9814 },
    { name: "Durham, NH", lng: -70.9367, lat: 43.1339 },
    { name: "Dover, NH", lng: -70.8686, lat: 43.1979 },
    { name: "Wells, ME", lng: -70.5895, lat: 43.3184 },
    { name: "Saco, ME", lng: -70.4453, lat: 43.5006 },
    { name: "Old Orchard Beach, ME", lng: -70.3792, lat: 43.5223 },
    { name: "Portland, ME", lng: -70.2504, lat: 43.6555 },
    { name: "Freeport, ME", lng: -70.1031, lat: 43.857 },
    { name: "Brunswick, ME", lng: -69.9653, lat: 43.9145 },
  ],
};
