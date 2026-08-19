// Vignelli-style saturated route colors, cycled when a new route is created.
export const LINE_COLOR_PALETTE = [
  "#EE352E", // red
  "#0039A6", // blue
  "#FF6319", // orange
  "#00933C", // green
  "#B933AD", // purple
  "#FCCC0A", // yellow
  "#6CBE45", // light green
  "#996633", // brown
  "#A7A9AC", // grey
  "#00ADD0", // teal
];

export function nextRouteColor(existingCount: number): string {
  return LINE_COLOR_PALETTE[existingCount % LINE_COLOR_PALETTE.length];
}
