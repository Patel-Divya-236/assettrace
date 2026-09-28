// One place that decides how every status looks: icon + colour + i18n key.
// Status is never shown by colour alone (CLAUDE.md section 8).
import type { AssetStatus, PublicStatus, ReportStatus } from "../api/types";

type Look = { icon: string; className: string; key: string };

// Colour classes are full strings so Tailwind can find them at build time.
export const STATUS_LOOK: Record<AssetStatus, Look> = {
  PLANNED: { icon: "clipboard", className: "bg-slate-100 text-slate-800 ring-slate-300", key: "status.PLANNED" },
  ACQUIRED: { icon: "box", className: "bg-indigo-50 text-indigo-800 ring-indigo-300", key: "status.ACQUIRED" },
  COMMISSIONED: { icon: "plug", className: "bg-sky-50 text-sky-800 ring-sky-300", key: "status.COMMISSIONED" },
  IN_OPERATION: { icon: "checkCircle", className: "bg-green-50 text-green-800 ring-green-400", key: "status.IN_OPERATION" },
  UNDER_MAINTENANCE: { icon: "wrench", className: "bg-amber-50 text-amber-900 ring-amber-400", key: "status.UNDER_MAINTENANCE" },
  DECOMMISSIONED: { icon: "power", className: "bg-orange-50 text-orange-900 ring-orange-300", key: "status.DECOMMISSIONED" },
  DISPOSED: { icon: "archive", className: "bg-gray-200 text-gray-800 ring-gray-400", key: "status.DISPOSED" },
};

export const PUBLIC_LOOK: Record<PublicStatus, Look> = {
  WORKING: { icon: "checkCircle", className: "bg-green-50 text-green-800 ring-green-500", key: "publicStatus.WORKING" },
  BEING_REPAIRED: { icon: "wrench", className: "bg-amber-50 text-amber-900 ring-amber-500", key: "publicStatus.BEING_REPAIRED" },
  NOT_IN_SERVICE: { icon: "xCircle", className: "bg-gray-100 text-gray-800 ring-gray-400", key: "publicStatus.NOT_IN_SERVICE" },
};

export const REPORT_LOOK: Record<ReportStatus, Look> = {
  RECEIVED: { icon: "message", className: "bg-sky-50 text-sky-800 ring-sky-300", key: "reportStatus.RECEIVED" },
  ASSIGNED: { icon: "wrench", className: "bg-amber-50 text-amber-900 ring-amber-400", key: "reportStatus.ASSIGNED" },
  FIXED: { icon: "checkCircle", className: "bg-green-50 text-green-800 ring-green-400", key: "reportStatus.FIXED" },
  REJECTED: { icon: "xCircle", className: "bg-gray-100 text-gray-800 ring-gray-400", key: "reportStatus.REJECTED" },
};

// Colours for charts and map markers (same hue family as the badges).
export const STATUS_HEX: Record<AssetStatus, string> = {
  PLANNED: "#64748b",
  ACQUIRED: "#4f46e5",
  COMMISSIONED: "#0284c7",
  IN_OPERATION: "#16a34a",
  UNDER_MAINTENANCE: "#d97706",
  DECOMMISSIONED: "#ea580c",
  DISPOSED: "#4b5563",
};

// Icon for an asset type (admin picks a name; unknown names fall back to a box).
export const typeIcon = (icon: string | null | undefined) => icon || "box";
