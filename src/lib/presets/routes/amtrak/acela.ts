import { PresetRoute } from "../../types";

export const acela: PresetRoute = {
  id: "amtrak-acela",
  name: "Acela",
  groupId: "amtrak",
  description: "Amtrak · Boston – Washington, DC",
  stops: [
    { name: "Boston South Station", lng: -71.0552, lat: 42.3519 },
    { name: "Boston Back Bay", lng: -71.0757, lat: 42.3475 },
    { name: "Route 128 (Westwood, MA)", lng: -71.1477, lat: 42.2088 },
    { name: "Providence, RI", lng: -71.4128, lat: 41.8296 },
    { name: "New Haven Union Station, CT", lng: -72.9268, lat: 41.2967 },
    { name: "Stamford, CT", lng: -73.5423, lat: 41.0466 },
    { name: "New York Penn Station", lng: -73.9939, lat: 40.7506 },
    { name: "Newark Penn Station, NJ", lng: -74.1644, lat: 40.7342 },
    { name: "Metropark, NJ", lng: -74.3629, lat: 40.5729 },
    { name: "Philadelphia 30th Street Station", lng: -75.1822, lat: 39.9566 },
    { name: "Wilmington, DE", lng: -75.554, lat: 39.7368 },
    { name: "Baltimore Penn Station", lng: -76.6156, lat: 39.3078 },
    { name: "BWI Airport Station, MD", lng: -76.6857, lat: 39.1954 },
    { name: "Washington Union Station, DC", lng: -77.0068, lat: 38.8973 },
  ],
};
