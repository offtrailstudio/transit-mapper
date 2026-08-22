import { LegacyRoute } from "../../legacy";

export const ksRoute: LegacyRoute = {
  id: "ucat-ks-route",
  name: "KS Route",
  color: "#17A398",
  routeType: "bus",
  groupId: "ucat",
  description: "UCAT · Kingston – Saugerties via US-9W",
  stops: [
    { name: "Development Court", lng: -74.0035, lat: 41.9366 },
    { name: "Kingston Plaza", lng: -73.9976, lat: 41.933 },
    { name: "Hudson Valley Mall", lng: -73.9903, lat: 41.9825 },
    { name: "Lake Katrine", lng: -73.988, lat: 41.997 },
    { name: "Saugerties Price Chopper", lng: -73.956, lat: 42.07 },
    { name: "Saugerties Village", lng: -73.9524, lat: 42.0776 },
  ],
};
