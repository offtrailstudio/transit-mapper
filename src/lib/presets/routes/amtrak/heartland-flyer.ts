import { LegacyPresetRoute } from "../../legacy";

export const heartlandFlyer: LegacyPresetRoute = {
  id: "amtrak-heartland-flyer",
  name: "Heartland Flyer",
  groupId: "amtrak",
  description: "Amtrak · Oklahoma City – Fort Worth",
  stops: [
    { name: "Oklahoma City (Santa Fe Depot)", lng: -97.5157, lat: 35.4657 },
    { name: "Norman, OK", lng: -97.4395, lat: 35.2226 },
    { name: "Purcell, OK", lng: -97.3573, lat: 35.012 },
    { name: "Pauls Valley, OK", lng: -97.2184, lat: 34.7418 },
    { name: "Ardmore, OK", lng: -97.1255, lat: 34.1721 },
    { name: "Gainesville, TX", lng: -97.1407, lat: 33.625 },
    { name: "Fort Worth Central Station", lng: -97.3283, lat: 32.755 },
  ],
};
