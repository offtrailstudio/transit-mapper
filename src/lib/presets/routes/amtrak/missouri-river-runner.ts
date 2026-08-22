import { LegacyPresetRoute } from "../../legacy";

export const missouriRiverRunner: LegacyPresetRoute = {
  id: "amtrak-missouri-river-runner",
  name: "Missouri River Runner",
  groupId: "amtrak",
  description: "Amtrak · Kansas City – St. Louis",
  stops: [
    { name: "Kansas City Union Station", lng: -94.5855, lat: 39.0848 },
    { name: "Independence Station", lng: -94.4296, lat: 39.0867 },
    { name: "Lee's Summit Station", lng: -94.3783, lat: 38.9124 },
    { name: "Warrensburg Station", lng: -93.7409, lat: 38.7628 },
    { name: "Sedalia Station", lng: -93.2284, lat: 38.7116 },
    { name: "Jefferson City Station", lng: -92.17, lat: 38.5787 },
    { name: "Hermann Station", lng: -91.4327, lat: 38.7073 },
    { name: "Washington Station", lng: -91.0125, lat: 38.5616 },
    { name: "Kirkwood Station", lng: -90.4068, lat: 38.5809 },
    { name: "Gateway Transportation Center (St. Louis)", lng: -90.2036, lat: 38.6242 },
  ],
};
