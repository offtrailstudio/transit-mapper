"use client";

import { useState } from "react";
import { Modal } from "../Modal";
import { useMapData } from "../../context/MapDataContext";
import { defaultRouteTypes, ROUTE_TYPE_DEFAULTS, ROUTE_TYPES } from "../../lib/lineKinds";
import { RouteType } from "../../lib/types";

const FIELD =
  "rounded-md border border-neutral-300 bg-white px-2 py-1 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white";
const LABEL = "text-xs font-semibold uppercase tracking-wide text-neutral-500";

type Tab = "routes" | "types";

/**
 * A number field that keeps its own text while editing so the box can be cleared
 * and retyped — it commits only valid values and reverts to the last good one on
 * blur. A plain controlled input guarded on validity blocks the empty
 * intermediate state and feels like it can't be typed in.
 */
function NumberField({
  value,
  onCommit,
  min = 1,
  label,
  className,
  disabled,
}: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  // Reset the buffer when the committed value changes from elsewhere (e.g.
  // switching a route's type re-seeds its frequency) — the render-phase pattern
  // React recommends over an effect. Typing that doesn't commit leaves `value`
  // unchanged, so the in-progress text (including empty) survives.
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }

  return (
    <input
      type="number"
      min={min}
      step={1}
      value={text}
      aria-label={label}
      disabled={disabled}
      className={`${FIELD} ${className ?? "w-20"} disabled:cursor-not-allowed disabled:opacity-60`}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n >= min) {
          onCommit(n);
        }
      }}
      onBlur={() => {
        const n = Number(text);
        if (!Number.isFinite(n) || n < min) {
          setText(String(value));
        }
      }}
    />
  );
}

export function SimSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch, readOnly } = useMapData();
  const routeTypes = state.data.routeTypes ?? defaultRouteTypes();
  const [tab, setTab] = useState<Tab>("routes");

  return (
    <Modal open={open} onClose={onClose} title="Simulation settings">
      {readOnly && (
        <p className="mb-3 text-sm text-neutral-500">
          These settings are read-only on a shared map.
        </p>
      )}
      <div className="mb-3 flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
        {(["routes", "types"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            {t === "routes" ? "Lines" : "Transit types"}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {tab === "routes" ? (
          state.data.routes.length === 0 ? (
            <p className="text-sm text-neutral-500">Add a route to configure it.</p>
          ) : (
            <ul className="space-y-3">
              {state.data.routes.map((route) => {
                const routeType = route.routeType ?? "subway";
                return (
                  <li
                    key={route.id}
                    className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: route.routeColor }}
                      />
                      <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                        {route.name}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <label className="flex flex-1 flex-col gap-1">
                        <span className={LABEL}>Type</span>
                        <select
                          value={routeType}
                          disabled={readOnly}
                          onChange={(e) =>
                            dispatch({
                              type: "SET_ROUTE_TYPE",
                              routeId: route.id,
                              routeType: e.target.value as RouteType,
                            })
                          }
                          className={`${FIELD} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {ROUTE_TYPES.map((k) => (
                            <option key={k} value={k}>
                              {ROUTE_TYPE_DEFAULTS[k].label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={LABEL}>Frequency</span>
                        <span className="flex items-center gap-1.5">
                          <NumberField
                            value={route.headwayMin ?? ROUTE_TYPE_DEFAULTS[routeType].headwayMin}
                            onCommit={(n) =>
                              dispatch({
                                type: "SET_ROUTE_HEADWAY",
                                routeId: route.id,
                                headwayMin: n,
                              })
                            }
                            label={`${route.name} minutes between departures`}
                            className="w-16"
                            disabled={readOnly}
                          />
                          <span className="text-sm text-neutral-500">min</span>
                        </span>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <>
            <p className="mb-2 text-sm text-neutral-500">
              Average speed for each type, in km/h. Every route of a type shares it.
            </p>
            <ul className="space-y-2">
              {ROUTE_TYPES.map((routeType) => (
                <li key={routeType} className="flex items-center justify-between gap-3">
                  <span className="text-base text-neutral-800 dark:text-neutral-200">
                    {ROUTE_TYPE_DEFAULTS[routeType].label}
                  </span>
                  <label className="flex items-center gap-1.5 text-sm text-neutral-500">
                    <NumberField
                      value={routeTypes[routeType].speedKmh}
                      onCommit={(n) => dispatch({ type: "SET_ROUTE_TYPE_SPEED", routeType, speedKmh: n })}
                      label={`${ROUTE_TYPE_DEFAULTS[routeType].label} speed in km/h`}
                      disabled={readOnly}
                    />
                    km/h
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
