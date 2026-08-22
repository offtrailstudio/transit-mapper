import { LegacyRoute } from "../../legacy";

export const keystoneService: LegacyRoute = {
  id: "amtrak-keystone-service",
  name: "Keystone Service",
  groupId: "amtrak",
  description: "Amtrak · New York – Harrisburg",
  stops: [
    { name: "New York Penn Station", lng: -73.9939, lat: 40.7506 },
    { name: "Newark Penn Station, NJ", lng: -74.1644, lat: 40.7342 },
    { name: "Metropark, NJ", lng: -74.3629, lat: 40.5729 },
    { name: "New Brunswick, NJ", lng: -74.4457, lat: 40.4994 },
    { name: "Princeton Junction, NJ", lng: -74.6193, lat: 40.3296 },
    { name: "Trenton Transit Center, NJ", lng: -74.7566, lat: 40.2171 },
    { name: "Philadelphia 30th Street Station", lng: -75.1822, lat: 39.9566 },
    { name: "Paoli, PA", lng: -75.4805, lat: 40.0409 },
    { name: "Exton, PA", lng: -75.6238, lat: 40.029 },
    { name: "Downingtown, PA", lng: -75.7038, lat: 40.0068 },
    { name: "Coatesville, PA", lng: -75.8244, lat: 39.9834 },
    { name: "Lancaster, PA", lng: -76.3055, lat: 40.0417 },
    { name: "Elizabethtown, PA", lng: -76.6019, lat: 40.1523 },
    { name: "Harrisburg Transportation Center", lng: -76.883, lat: 40.2665 },
  ],
};
