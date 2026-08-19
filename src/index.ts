// Public API for @offtrailstudio/transit-mapper — the embeddable transit map
// editor. The host app wires persistence/cloud/routing around this surface; see
// the repo's own app (AppMapDataProvider, AppRail) for a reference integration.

// --- Editor shell & surfaces ---
export { AppShell } from "./components/AppShell";
export { MobileTopBar } from "./components/MobileTopBar";
export { MapEditor } from "./components/map/MapEditor";
export { Modal } from "./components/Modal";
export { Tooltip } from "./components/Tooltip";
export { InputOTP, InputOTPGroup, InputOTPSlot } from "./components/ui/input-otp";

// --- Toolbar primitives (the host composes its own rail from these) ---
export {
  RailShell,
  RailDivider,
  RailTopDivider,
  UndoButton,
  RedoButton,
  SimulateButton,
  ExportButton,
} from "./components/rail/railKit";
export { RAIL_ASIDE, RAIL_BUTTON, RAIL_ICON_SIZE } from "./components/rail/railStyles";

// --- Host-injected configuration (Mapbox token) ---
export { EditorConfigProvider, useEditorConfig } from "./context/ConfigContext";
export type { EditorConfig } from "./context/ConfigContext";

// --- Data / state ---
export { MapDataProvider, SharedMapProvider, useMapData } from "./context/MapDataContext";
export type { ProjectSummary, CloudSyncHandle, UseCloudSync } from "./context/MapDataContext";

// --- Persistence helpers (the host chooses how to wire these) ---
export {
  loadProjects,
  saveProjects,
  projectForkedFrom,
  projectUpdatedAt,
  remintProject,
} from "./lib/projects";
export type { ProjectsFile } from "./lib/projects";

// --- Cloud-sync domain (pure; the host owns the actual transport) ---
export { reconcileMaps } from "./lib/cloudSync";
export type { CloudMap } from "./lib/cloudSync";

// --- Data model & migration ---
export { normalizeMapData } from "./lib/migrate";
export type { TransitMapData } from "./lib/types";

// --- Export / render ---
export { computeExportLayout, DEFAULT_PRINT_SIZE_ID } from "./lib/exportGeometry";
export type { LayoutMode } from "./lib/exportGeometry";
export { buildExportSvg, buildPreviewSvg } from "./lib/exportSvg";
