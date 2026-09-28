// The lifecycle rules as plain data + pure functions (no database), so they can be
// unit-tested and read in one place. CLAUDE.md sections 6.1 and 6.2.
import type { AssetStatus, Role } from "@prisma/client";

export const STATUS_LABEL: Record<AssetStatus, string> = {
  PLANNED: "Planned",
  ACQUIRED: "Acquired",
  COMMISSIONED: "Commissioned",
  IN_OPERATION: "In operation",
  UNDER_MAINTENANCE: "Under maintenance",
  DECOMMISSIONED: "Decommissioned",
  DISPOSED: "Disposed",
};

// Which moves exist at all.
export const ALLOWED_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  PLANNED: ["ACQUIRED"],
  ACQUIRED: ["COMMISSIONED"],
  COMMISSIONED: ["IN_OPERATION"],
  IN_OPERATION: ["UNDER_MAINTENANCE", "DECOMMISSIONED"],
  UNDER_MAINTENANCE: ["IN_OPERATION", "DECOMMISSIONED"],
  DECOMMISSIONED: ["DISPOSED"],
  DISPOSED: [],
};

// Which roles may make which moves. "*" = every move in ALLOWED_TRANSITIONS.
type Move = `${AssetStatus}->${AssetStatus}`;
export const ROLE_TRANSITIONS: Record<Role, Move[] | "*"> = {
  ADMIN: "*",
  FIELD_OFFICER: ["IN_OPERATION->UNDER_MAINTENANCE", "UNDER_MAINTENANCE->IN_OPERATION"],
  VIEWER: [],
};

// Data that must be supplied when entering a stage.
export const REQUIRED_FIELDS: Partial<Record<AssetStatus, StageField[]>> = {
  ACQUIRED: ["acquiredDate", "cost", "vendor"],
  COMMISSIONED: ["commissionedDate"],
  DISPOSED: ["disposalMethod"],
};

// Optional extras accepted for a stage.
export const OPTIONAL_FIELDS: Partial<Record<AssetStatus, StageField[]>> = {
  COMMISSIONED: ["warrantyEnd"],
  DISPOSED: ["disposalValue"],
};

export type StageField =
  | "acquiredDate"
  | "cost"
  | "vendor"
  | "commissionedDate"
  | "warrantyEnd"
  | "disposalMethod"
  | "disposalValue";

export type StageData = Partial<Record<StageField, string | number>>;

export type Check = { ok: true } | { ok: false; code: string; message: string; details?: Record<string, unknown> };

const roleAllows = (role: Role, from: AssetStatus, to: AssetStatus) => {
  const moves = ROLE_TRANSITIONS[role];
  return moves === "*" || moves.includes(`${from}->${to}`);
};

/** Is this move valid, and is this role allowed to make it? */
export function canTransition(from: AssetStatus, to: AssetStatus, role: Role): Check {
  const next = ALLOWED_TRANSITIONS[from];
  if (!next.includes(to)) {
    const message =
      next.length === 0
        ? `An asset that is ${STATUS_LABEL[from]} can't be changed. ${STATUS_LABEL[from]} is the final stage.`
        : `An asset that is ${STATUS_LABEL[from]} can't be ${STATUS_LABEL[to]}. Next allowed step: ${next
            .map((s) => STATUS_LABEL[s])
            .join(" or ")}.`;
    return { ok: false, code: "INVALID_TRANSITION", message, details: { from, to, allowed: next } };
  }
  if (!roleAllows(role, from, to)) {
    return {
      ok: false,
      code: "FORBIDDEN_TRANSITION",
      message: `Your role can't move an asset from ${STATUS_LABEL[from]} to ${STATUS_LABEL[to]}. Ask an admin.`,
      details: { from, to, role },
    };
  }
  return { ok: true };
}

/**
 * Guards that depend on the asset's tickets (D-21):
 * - repair can't be marked done while tickets are open
 * - an asset with open tickets can't be decommissioned
 */
export function checkOpenTickets(from: AssetStatus, to: AssetStatus, openTickets: number): Check {
  if (openTickets === 0) return { ok: true };
  if (from === "UNDER_MAINTENANCE" && to === "IN_OPERATION") {
    return {
      ok: false,
      code: "OPEN_TICKETS",
      message: `Close the open tickets first (${openTickets} open). Closing the last one puts the asset back in operation.`,
      details: { openTickets },
    };
  }
  if (to === "DECOMMISSIONED") {
    return {
      ok: false,
      code: "OPEN_TICKETS",
      message: `This asset has ${openTickets} open ticket(s). Close them before decommissioning.`,
      details: { openTickets },
    };
  }
  return { ok: true };
}

/** Which required stage fields are missing for entering `to`. */
export function missingStageFields(to: AssetStatus, data: StageData = {}): StageField[] {
  return (REQUIRED_FIELDS[to] ?? []).filter((f) => data[f] === undefined || data[f] === "");
}

/** The buttons the UI may show: valid moves for this role that pass the ticket guards. */
export function getAllowedTransitions(from: AssetStatus, role: Role, openTickets = 0): AssetStatus[] {
  return ALLOWED_TRANSITIONS[from].filter(
    (to) => canTransition(from, to, role).ok && checkOpenTickets(from, to, openTickets).ok,
  );
}
