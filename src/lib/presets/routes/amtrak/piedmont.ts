import { LegacyPresetRoute } from "../../legacy";

export const piedmont: LegacyPresetRoute = {
  id: "amtrak-piedmont",
  name: "Piedmont",
  groupId: "amtrak",
  description: "Amtrak · Raleigh – Charlotte",
  stops: [
    { name: "Raleigh Union Station", lng: -78.6472, lat: 35.7772 },
    { name: "Cary Station", lng: -78.7813, lat: 35.7886 },
    { name: "Durham Station", lng: -78.9065, lat: 35.9975 },
    { name: "Burlington Station", lng: -79.4352, lat: 36.0951 },
    { name: "Greensboro Station", lng: -79.7872, lat: 36.0694 },
    { name: "High Point Station", lng: -80.0064, lat: 35.9572 },
    { name: "Salisbury Station", lng: -80.4662, lat: 35.6673 },
    { name: "Kannapolis Station", lng: -80.6246, lat: 35.496 },
    { name: "Charlotte Station", lng: -80.8228, lat: 35.2411 },
  ],
};
