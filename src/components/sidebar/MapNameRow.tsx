"use client";

import { useMapData } from "../../context/MapDataContext";

export function MapNameRow() {
  const { state, dispatch, readOnly } = useMapData();

  if (readOnly) {
    return (
      <h1 className="-mx-1 truncate px-1 py-1 text-2xl font-semibold text-neutral-900 dark:text-white">
        {state.data.title || "Untitled Map"}
      </h1>
    );
  }

  return (
    <input
      type="text"
      value={state.data.title}
      onChange={(e) => dispatch({ type: "SET_TITLE", title: e.target.value })}
      placeholder="Untitled Map"
      aria-label="Map name"
      className="-mx-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-2xl font-semibold text-neutral-900 placeholder:text-neutral-400 hover:border-neutral-300 focus:border-neutral-300 focus:bg-white focus:outline-none dark:text-white dark:placeholder:text-neutral-600 dark:hover:border-neutral-700 dark:focus:border-neutral-700 dark:focus:bg-neutral-900"
    />
  );
}
