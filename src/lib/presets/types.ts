import { RouteType } from "../types";

export type PresetStop = { name: string; lng: number; lat: number };

export type PresetRoute = {
  id: string;
  name: string;
  color?: string;
  /** GTFS route_type. Omitted presets adopt the editor's default type. */
  routeType?: RouteType;
  description?: string;
  groupId?: string;
  stops: PresetStop[];
};

export type PresetGroup = { id: string; name: string; description?: string };
