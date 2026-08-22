import { LegacyPresetRoute } from "../../legacy";

export const cardinal: LegacyPresetRoute = {
  id: "amtrak-cardinal",
  name: "Cardinal",
  groupId: "amtrak",
  description: "Amtrak · New York – Chicago",
  stops: [
    { name: "New York Penn Station", lng: -73.9939, lat: 40.7506 },
    { name: "Philadelphia 30th Street Station", lng: -75.1822, lat: 39.9566 },
    { name: "Baltimore Penn Station", lng: -76.6156, lat: 39.3075 },
    { name: "Washington Union Station", lng: -77.0063, lat: 38.8971 },
    { name: "Charlottesville Union Station", lng: -78.4919, lat: 38.0314 },
    { name: "Clifton Forge Station", lng: -79.8274, lat: 37.8146 },
    { name: "White Sulphur Springs Station", lng: -80.3056, lat: 37.7853 },
    { name: "Hinton Station", lng: -80.8922, lat: 37.6747 },
    { name: "Charleston Station", lng: -81.6383, lat: 38.3464 },
    { name: "Huntington Station", lng: -82.4397, lat: 38.4159 },
    { name: "Ashland Transportation Center", lng: -82.6394, lat: 38.4808 },
    { name: "Cincinnati Union Terminal", lng: -84.5378, lat: 39.11 },
    { name: "Indianapolis Union Station", lng: -86.1609, lat: 39.762 },
    { name: "Lafayette Station", lng: -86.8956, lat: 40.4186 },
    { name: "Chicago Union Station", lng: -87.6402, lat: 41.8786 },
  ],
};
