"use client";

import { usePrintMode } from "../../context/PrintModeContext";
import { usePrintSheet } from "../../hooks/usePrintSheet";
import { PRINT_SIZES, STATION_RADIUS_PX } from "../../lib/exportGeometry";

// Comfortably bigger than a station dot: on a sheet scaled to fit the window a
// marker is only a few real pixels across, and this has to be clickable.
const HIT_RADIUS_PX = STATION_RADIUS_PX * 4;

/**
 * The sheet itself, filling the middle of the screen while print mode is on.
 *
 * This is the real export SVG — the same string the Download button writes to a
 * file — scaled to fit rather than redrawn, so what's on screen cannot disagree
 * with what comes out. It sits over the map as an overlay rather than replacing
 * it, because unmounting the WebGL map to show a preview and remounting it on
 * the way back is both slow and enough to lose the camera position.
 *
 * Click targets are a *separate* SVG laid over the sheet, sharing its viewBox so
 * the two align at any scale. They can't live inside the sheet: that string has
 * to stay byte-identical to what downloads, and anything appended to it is
 * destroyed the moment the sheet is re-rendered (changing the background rewrites
 * it, which is exactly how selection came to work only some of the time).
 */
export function PrintPreview() {
  const { settings, selectedStopId, selectStop } = usePrintMode();
  const { svg, basemapPending, layout } = usePrintSheet();
  const size = PRINT_SIZES.find((s) => s.id === settings.sizeId) ?? PRINT_SIZES[0];
  const stops = layout.stations.length;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-neutral-200/95 backdrop-blur-sm dark:bg-neutral-950/95">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-2 text-xs text-neutral-600 dark:text-neutral-400">
        <span className="font-medium">
          Print preview
          <span className="ml-2 font-normal text-neutral-500">Click a stop to adjust its label</span>
        </span>
        <span className="font-mono tabular-nums">
          {size.label} · {stops} {stops === 1 ? "stop" : "stops"}
          {basemapPending && " · loading map background…"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 pt-0" onClick={() => selectStop(null)}>
        {stops === 0 ? (
          <p className="grid h-full place-items-center text-sm text-neutral-500">
            Add a stop or two and the sheet will appear here.
          </p>
        ) : (
          <div className="mx-auto grid h-full place-items-center">
            {/*
              The wrapper takes its size from the sheet, so the overlay below can
              fill it exactly. The sheet's SVG carries its own print-size
              width/height attributes; the CSS overrides them so it scales to
              whatever room the window has, keeping aspect via its viewBox.
            */}
            <div className="relative max-h-full max-w-full overflow-hidden rounded shadow-2xl">
              <div
                role="img"
                aria-label={`Print preview of ${layout.title || "the map"} at ${size.label}`}
                className="[&>svg]:block [&>svg]:h-auto [&>svg]:max-h-[calc(100vh-9rem)] [&>svg]:w-auto [&>svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />

              <svg
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${layout.widthPx} ${layout.heightPx}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {layout.stations.map((station) => (
                  <g key={station.id}>
                    {station.id === selectedStopId && (
                      <circle
                        cx={station.x}
                        cy={station.y}
                        r={HIT_RADIUS_PX * 0.85}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth={22}
                        pointerEvents="none"
                      />
                    )}
                    <circle
                      cx={station.x}
                      cy={station.y}
                      r={HIT_RADIUS_PX}
                      fill="transparent"
                      style={{ cursor: "pointer" }}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectStop(station.id);
                      }}
                    >
                      <title>{station.name}</title>
                    </circle>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
