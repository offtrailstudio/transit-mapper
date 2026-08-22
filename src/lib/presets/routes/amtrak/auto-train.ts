import { LegacyRoute } from "../../legacy";

export const autoTrain: LegacyRoute = {
  id: "amtrak-auto-train",
  name: "Auto Train",
  groupId: "amtrak",
  description: "Amtrak · Lorton – Sanford",
  stops: [
    { name: "Lorton Station", lng: -77.2207, lat: 38.7084 },
    { name: "Sanford Station", lng: -81.2984, lat: 28.8136 },
  ],
};
