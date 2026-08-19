"use client";

import { useMapData } from "../../context/MapDataContext";
import { RouteListItem } from "./LineListItem";

export function RouteList() {
  const { state } = useMapData();

  if (state.data.routes.length === 0) {
    return (
      <p className="text-base text-neutral-500">
        No routes yet — add one, then add stops to it.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {state.data.routes.map((route) => (
        <RouteListItem key={route.id} route={route} />
      ))}
    </ul>
  );
}
