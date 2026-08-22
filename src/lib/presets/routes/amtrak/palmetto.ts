import { LegacyRoute } from "../../legacy";

export const palmetto: LegacyRoute = {
  id: "amtrak-palmetto",
  name: "Palmetto",
  groupId: "amtrak",
  description: "Amtrak · New York – Savannah",
  stops: [
    { name: "New York Penn Station", lng: -73.9939, lat: 40.7506 },
    { name: "Philadelphia 30th Street Station", lng: -75.1822, lat: 39.9566 },
    { name: "Wilmington Station", lng: -75.5511, lat: 39.7368 },
    { name: "Baltimore Penn Station", lng: -76.6156, lat: 39.3075 },
    { name: "Washington Union Station", lng: -77.0063, lat: 38.8971 },
    { name: "Richmond Staples Mill Road Station", lng: -77.4969, lat: 37.6178 },
    { name: "Rocky Mount Station", lng: -77.7977, lat: 35.938 },
    { name: "Fayetteville Station", lng: -78.8847, lat: 35.055 },
    { name: "Florence Station", lng: -79.7575, lat: 34.1993 },
    { name: "North Charleston Station", lng: -79.9981, lat: 32.8747 },
    { name: "Savannah Station", lng: -81.1486, lat: 32.0836 },
  ],
};
