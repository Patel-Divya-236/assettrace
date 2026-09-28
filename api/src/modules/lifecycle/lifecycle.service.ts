import type { AssetStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError, notFound } from "../../lib/AppError";
import { type Db, writeAudit } from "../../lib/audit";
import { OPEN_TICKET } from "../assets/assets.service";
import {
  type Check,
  canTransition,
  checkOpenTickets,
  missingStageFields,
  OPTIONAL_FIELDS,
  REQUIRED_FIELDS,
  type StageData,
  STATUS_LABEL,
} from "./lifecycle.rules";

// STAFF = a person pressed a button; REPORT = confirming a public report;
// TICKET = closing the last open ticket.
export type TransitionSource = "STAFF" | "REPORT" | "TICKET";

export type TransitionInput = {
  assetId: string;
  toStatus: AssetStatus;
  userId: string;
  role: Role;
  note?: string;
  stageData?: StageData;
  source?: TransitionSource;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function fail(check: Check, httpStatus = 409) {
  if (!check.ok) throw new AppError(httpStatus, check.code, check.message, check.details);
}

// Only the stage fields that belong to the target stage are written.
function stageUpdate(to: AssetStatus, data: StageData): Prisma.AssetUpdateManyMutationInput {
  const allowed = [...(REQUIRED_FIELDS[to] ?? []), ...(OPTIONAL_FIELDS[to] ?? [])];
  const update: Record<string, unknown> = {};
  for (const field of allowed) {
    const value = data[field];
    if (value === undefined) continue;
    update[field] = field.endsWith("Date") || field === "warrantyEnd" ? new Date(value) : value;
  }
  return update as Prisma.AssetUpdateManyMutationInput;
}

/**
 * THE ONLY place that changes asset.status (CLAUDE.md 6.1).
 * Runs in one transaction: re-read, validate move + role + guards + stage data,
 * conditional update, lifecycle event, audit row, and the corrective ticket.
 * Pass `tx` to run inside a caller's transaction (report confirm, ticket close).
 */
export function transitionAsset(input: TransitionInput, tx?: Db) {
  return tx ? runTransition(tx, input) : prisma.$transaction((t) => runTransition(t, input));
}

async function runTransition(tx: Db, input: TransitionInput) {
  const { assetId, toStatus, userId, role, note, stageData = {}, source = "STAFF" } = input;

  const asset = await tx.asset.findUnique({ where: { id: assetId }, include: { type: true } });
  if (!asset) throw notFound("Asset");
  const from = asset.status;

  fail(canTransition(from, toStatus, role), role === "VIEWER" ? 403 : 409);

  const openTickets = await tx.maintenanceTicket.count({ where: { assetId, ...OPEN_TICKET } });
  fail(checkOpenTickets(from, toStatus, openTickets));

  const missing = missingStageFields(toStatus, stageData);
  if (missing.length > 0) {
    throw new AppError(400, "STAGE_DATA_REQUIRED", `To mark this asset ${STATUS_LABEL[toStatus]}, fill in: ${missing.join(", ")}.`, {
      fields: Object.fromEntries(missing.map((f) => [f, "Required"])),
    });
  }

  const data: Prisma.AssetUpdateManyMutationInput = { status: toStatus, ...stageUpdate(toStatus, stageData) };
  // First time in operation: start the maintenance schedule.
  if (toStatus === "IN_OPERATION" && from === "COMMISSIONED" && asset.type.maintenanceIntervalDays) {
    data.nextMaintenanceDate = new Date(Date.now() + asset.type.maintenanceIntervalDays * DAY_MS);
  }

  // Conditional update (D-23): only succeeds if nobody changed the status since we read it.
  const { count } = await tx.asset.updateMany({ where: { id: assetId, status: from }, data });
  if (count === 0) {
    throw new AppError(409, "CONFLICT", "Someone else changed this asset just now. Refresh and try again.");
  }

  await tx.lifecycleEvent.create({
    data: { assetId, fromStatus: from, toStatus, userId, note: note ?? null },
  });
  await writeAudit(tx, {
    entity: "Asset",
    entityId: assetId,
    action: "TRANSITION",
    userId,
    changes: { from, to: toStatus, source, stageData: stageData as Prisma.InputJsonValue },
  });

  // A person marking an asset for repair gets a work ticket automatically.
  // Reports create their own ticket, so skip it for them.
  if (toStatus === "UNDER_MAINTENANCE" && source === "STAFF") {
    const ticket = await tx.maintenanceTicket.create({
      data: {
        assetId,
        kind: "CORRECTIVE",
        description: note || "Marked for repair by staff",
        createdById: userId,
      },
    });
    await writeAudit(tx, { entity: "MaintenanceTicket", entityId: ticket.id, action: "CREATE", userId, changes: { source: "TRANSITION" } });
  }

  return tx.asset.findUniqueOrThrow({ where: { id: assetId } });
}

export async function getTimeline(assetId: string, page: number, pageSize: number) {
  const exists = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!exists) throw notFound("Asset");
  const where = { assetId };
  const [items, total] = await prisma.$transaction([
    prisma.lifecycleEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
    prisma.lifecycleEvent.count({ where }),
  ]);
  return { items, page, pageSize, total };
}
