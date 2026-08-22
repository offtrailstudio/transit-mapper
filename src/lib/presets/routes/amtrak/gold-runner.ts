import { LegacyPresetRoute } from "../../legacy";

export const goldRunner: LegacyPresetRoute = {
  id: "amtrak-gold-runner",
  name: "Gold Runner",
  groupId: "amtrak",
  description: "Amtrak · Oakland – Bakersfield",
  stops: [
    { name: "Oakland-Jack London Square", lng: -122.2717, lat: 37.7955 },
    { name: "Emeryville, CA", lng: -122.2913, lat: 37.8405 },
    { name: "Martinez, CA", lng: -122.1341, lat: 38.0197 },
    { name: "Stockton (San Joaquin Street)", lng: -121.2905, lat: 37.9577 },
    { name: "Modesto, CA", lng: -120.9973, lat: 37.639 },
    { name: "Turlock-Denair, CA", lng: -120.7981, lat: 37.5273 },
    { name: "Merced, CA", lng: -120.483, lat: 37.3022 },
    { name: "Madera, CA", lng: -120.075, lat: 37.0225 },
    { name: "Fresno, CA", lng: -119.7871, lat: 36.7378 },
    { name: "Hanford, CA", lng: -119.6519, lat: 36.3261 },
    { name: "Corcoran, CA", lng: -119.5571, lat: 36.0984 },
    { name: "Wasco, CA", lng: -119.3319, lat: 35.5941 },
    { name: "Bakersfield, CA", lng: -119.0187, lat: 35.3733 },
  ],
};
