import { nextRouteColor } from "./colors";
import { DEFAULT_ROUTE_TYPE, defaultHeadwayForRouteType, defaultRouteTypes } from "./lineKinds";
import { primaryStopIds, updatePrimaryStopIds } from "./lines";
import { normalizeMapData } from "./migrate";
import { PresetRoute } from "./presets/types";
import { EMPTY_MAP_DATA, Route, RouteType, Stop, TransitMapData } from "./types";

export type EditorState = {
  data: TransitMapData;
  activeRouteId: string | null;
};

export const initialEditorState: EditorState = {
  data: EMPTY_MAP_DATA,
  activeRouteId: null,
};

export type Action =
  | { type: "LOAD"; data: TransitMapData }
  | { type: "ADD_ROUTE" }
  | { type: "ADD_PRESET_ROUTE"; preset: PresetRoute; merges?: Record<number, string> }
  | { type: "ADD_STOP"; lng: number; lat: number; name?: string; routeId?: string }
  | { type: "ADD_STOP_TO_ROUTE"; routeId: string; stopId: string }
  | { type: "REORDER_STOP"; routeId: string; index: number; direction: "up" | "down" }
  | { type: "REMOVE_STOP"; routeId: string; stopId: string }
  | { type: "DELETE_STOP"; stopId: string }
  | { type: "DELETE_ROUTE"; routeId: string }
  | { type: "SET_ACTIVE_ROUTE"; routeId: string | null }
  | { type: "RENAME_ROUTE"; routeId: string; name: string }
  | { type: "SET_ROUTE_COLOR"; routeId: string; routeColor: string }
  | { type: "TOGGLE_ROUTE_VISIBILITY"; routeId: string }
  | { type: "RENAME_STOP"; stopId: string; name: string }
  | { type: "MOVE_STOP"; stopId: string; lng: number; lat: number }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_ROUTE_TYPE"; routeId: string; routeType: RouteType }
  | { type: "SET_ROUTE_HEADWAY"; routeId: string; headwayMin: number }
  | { type: "SET_ROUTE_TYPE_SPEED"; routeType: RouteType; speedKmh: number };

function createId(): string {
  return crypto.randomUUID();
}

function updateRoute(routes: Route[], routeId: string, update: (route: Route) => Route): Route[] {
  return routes.map((route) => (route.id === routeId ? update(route) : route));
}

function updateStop(stops: Stop[], stopId: string, update: (stop: Stop) => Stop): Stop[] {
  return stops.map((stop) => (stop.id === stopId ? update(stop) : stop));
}

export function mapReducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "LOAD": {
      // Defensive: keeps in-memory state honest even if data arrived from a path
      // that skipped normalization.
      return { ...state, data: normalizeMapData(action.data) };
    }

    case "ADD_ROUTE": {
      const newRoute: Route = {
        id: createId(),
        name: `Route ${state.data.routes.length + 1}`,
        routeColor: nextRouteColor(state.data.routes.length),
        routeType: DEFAULT_ROUTE_TYPE,
        headwayMin: defaultHeadwayForRouteType(DEFAULT_ROUTE_TYPE),
        patterns: [{ id: createId(), stopIds: [] }],
      };
      return {
        data: { ...state.data, routes: [...state.data.routes, newRoute] },
        activeRouteId: newRoute.id,
      };
    }

    case "ADD_PRESET_ROUTE": {
      const merges = action.merges ?? {};
      const existingIds = new Set(state.data.stops.map((p) => p.id));
      // A stop with a valid merge target reuses that station's id instead of
      // minting a duplicate; every other stop becomes a fresh stop.
      const newStops: Stop[] = [];
      const stopIds = action.preset.stops.map((stop, index) => {
        const mergeId = merges[index];
        if (mergeId && existingIds.has(mergeId)) {
          return mergeId;
        }
        const newStop: Stop = { id: createId(), name: stop.name, lng: stop.lng, lat: stop.lat };
        newStops.push(newStop);
        return newStop.id;
      });
      const routeType = action.preset.routeType ?? DEFAULT_ROUTE_TYPE;
      const newRoute: Route = {
        id: createId(),
        name: action.preset.name,
        routeColor: action.preset.color ?? nextRouteColor(state.data.routes.length),
        routeType,
        headwayMin: defaultHeadwayForRouteType(routeType),
        patterns: [{ id: createId(), stopIds }],
      };
      return {
        data: {
          ...state.data,
          stops: [...state.data.stops, ...newStops],
          routes: [...state.data.routes, newRoute],
        },
        activeRouteId: newRoute.id,
      };
    }

    case "ADD_STOP": {
      const newStop: Stop = {
        id: createId(),
        name: action.name ?? `Station ${state.data.stops.length + 1}`,
        lng: action.lng,
        lat: action.lat,
      };
      const stops = [...state.data.stops, newStop];
      // An explicit routeId wins over the expanded route: stops added from a route's
      // own "Add stop" modal must land on that route even if another is expanded.
      const targetRouteId = action.routeId ?? state.activeRouteId;
      const routes = targetRouteId
        ? updateRoute(state.data.routes, targetRouteId, (route) =>
            updatePrimaryStopIds(route, (stopIds) => [...stopIds, newStop.id])
          )
        : state.data.routes;
      return { ...state, data: { ...state.data, stops, routes } };
    }

    case "ADD_STOP_TO_ROUTE": {
      const routes = updateRoute(state.data.routes, action.routeId, (route) =>
        primaryStopIds(route).includes(action.stopId)
          ? route
          : updatePrimaryStopIds(route, (stopIds) => [...stopIds, action.stopId])
      );
      return { ...state, data: { ...state.data, routes } };
    }

    case "REORDER_STOP": {
      const routes = updateRoute(state.data.routes, action.routeId, (route) => {
        const ids = primaryStopIds(route);
        const targetIndex = action.direction === "up" ? action.index - 1 : action.index + 1;
        if (targetIndex < 0 || targetIndex >= ids.length) {
          return route;
        }
        const stopIds = [...ids];
        [stopIds[action.index], stopIds[targetIndex]] = [stopIds[targetIndex], stopIds[action.index]];
        return updatePrimaryStopIds(route, () => stopIds);
      });
      return { ...state, data: { ...state.data, routes } };
    }

    case "REMOVE_STOP": {
      const routes = updateRoute(state.data.routes, action.routeId, (route) =>
        updatePrimaryStopIds(route, (stopIds) => stopIds.filter((id) => id !== action.stopId))
      );
      return { ...state, data: { ...state.data, routes } };
    }

    case "DELETE_STOP": {
      const stops = state.data.stops.filter((stop) => stop.id !== action.stopId);
      // A deleted station leaves *every* pattern of every route — not just the primary.
      const routes = state.data.routes.map((route) => ({
        ...route,
        patterns: route.patterns.map((pattern) => ({
          ...pattern,
          stopIds: pattern.stopIds.filter((id) => id !== action.stopId),
        })),
      }));
      return { ...state, data: { ...state.data, stops, routes } };
    }

    case "DELETE_ROUTE": {
      const routes = state.data.routes.filter((route) => route.id !== action.routeId);
      return {
        data: { ...state.data, routes },
        activeRouteId: state.activeRouteId === action.routeId ? null : state.activeRouteId,
      };
    }

    case "SET_ACTIVE_ROUTE": {
      return { ...state, activeRouteId: action.routeId };
    }

    case "RENAME_ROUTE": {
      const routes = updateRoute(state.data.routes, action.routeId, (route) => ({
        ...route,
        name: action.name,
      }));
      return { ...state, data: { ...state.data, routes } };
    }

    case "SET_ROUTE_COLOR": {
      const routes = updateRoute(state.data.routes, action.routeId, (route) => ({
        ...route,
        routeColor: action.routeColor,
      }));
      return { ...state, data: { ...state.data, routes } };
    }

    case "TOGGLE_ROUTE_VISIBILITY": {
      const routes = updateRoute(state.data.routes, action.routeId, (route) => ({
        ...route,
        hidden: !route.hidden,
      }));
      return { ...state, data: { ...state.data, routes } };
    }

    case "RENAME_STOP": {
      const stops = updateStop(state.data.stops, action.stopId, (stop) => ({
        ...stop,
        name: action.name,
      }));
      return { ...state, data: { ...state.data, stops } };
    }

    case "MOVE_STOP": {
      const stops = updateStop(state.data.stops, action.stopId, (stop) => ({
        ...stop,
        lng: action.lng,
        lat: action.lat,
      }));
      return { ...state, data: { ...state.data, stops } };
    }

    case "SET_TITLE": {
      return { ...state, data: { ...state.data, title: action.title } };
    }

    case "SET_ROUTE_TYPE": {
      // Switching type re-seeds the headway to that type's default, so a route
      // moved to "ferry" spaces out like a ferry unless the user then tweaks it.
      const routes = updateRoute(state.data.routes, action.routeId, (route) => ({
        ...route,
        routeType: action.routeType,
        headwayMin: defaultHeadwayForRouteType(action.routeType),
      }));
      return { ...state, data: { ...state.data, routes } };
    }

    case "SET_ROUTE_HEADWAY": {
      const routes = updateRoute(state.data.routes, action.routeId, (route) => ({
        ...route,
        headwayMin: action.headwayMin,
      }));
      return { ...state, data: { ...state.data, routes } };
    }

    case "SET_ROUTE_TYPE_SPEED": {
      const routeTypes = {
        ...defaultRouteTypes(),
        ...state.data.routeTypes,
        [action.routeType]: { speedKmh: action.speedKmh },
      };
      return { ...state, data: { ...state.data, routeTypes } };
    }

    default:
      return state;
  }
}
