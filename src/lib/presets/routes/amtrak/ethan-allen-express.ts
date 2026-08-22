import { LegacyPresetRoute } from "../../legacy";

export const ethanAllenExpress: LegacyPresetRoute = {
  id: "amtrak-ethan-allen-express",
  name: "Ethan Allen Express",
  groupId: "amtrak",
  description: "Amtrak · New York – Burlington, VT",
  stops: [
    { name: "New York Penn Station", lng: -73.9939, lat: 40.7506 },
    { name: "Yonkers, NY", lng: -73.8987, lat: 40.9312 },
    { name: "Croton-Harmon, NY", lng: -73.8918, lat: 41.1873 },
    { name: "Poughkeepsie, NY", lng: -73.9385, lat: 41.7017 },
    { name: "Rhinecliff, NY", lng: -73.9385, lat: 41.9251 },
    { name: "Hudson, NY", lng: -73.7898, lat: 42.2506 },
    { name: "Albany-Rensselaer, NY", lng: -73.744, lat: 42.63 },
    { name: "Schenectady, NY", lng: -73.9396, lat: 42.8137 },
    { name: "Saratoga Springs, NY", lng: -73.7909, lat: 43.0793 },
    { name: "Fort Edward-Glens Falls, NY", lng: -73.5843, lat: 43.2687 },
    { name: "Castleton, VT", lng: -73.1714, lat: 43.6133 },
    { name: "Rutland, VT", lng: -72.9817, lat: 43.6058 },
    { name: "Middlebury, VT", lng: -73.1698, lat: 44.0177 },
    { name: "Ferrisburgh-Vergennes, VT", lng: -73.2489, lat: 44.1809 },
    { name: "Burlington Union Station, VT", lng: -73.2121, lat: 44.4759 },
  ],
};
