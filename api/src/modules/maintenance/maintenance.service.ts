import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError, notFound } from "../../lib/AppError";
import { type Db, writeAudit } from "../../lib/audit";
import type { AuthUser } from "../../middleware/auth";
import { OPEN_TICKET } from "../assets/assets.service";
import { transitionAsset } from "../lifecycle/lifecycle.service";
import type {
  CloseTicketBody,
  CreateTicketBody,
  ListTicketsQuery,
  LogServiceBody,
  UpdateTicketBody,
} from "./maintenance.schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const SERVICEABLE = ["IN_OPERATION", "UNDER_MAINTENANCE"];

const ticketInclude = {
  asset: { select: { id: true, assetCode: true, name: true, status: true, locationText: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.MaintenanceTicketInclude;

export async function listTickets(q: ListTicketsQuery) {
  const where: Prisma.MaintenanceTicketWhereInput = {};
  if (q.status === "ACTIVE") Object.assign(where, OPEN_TICKET);
  else if (q.status) where.status = q.status;
  if (q.kind) where.kind = q.kind;
  if (q.assetId) where.assetId = q.assetId;

  const [items, total] = await prisma.$transaction([
    prisma.maintenanceTicket.findMany({
      where,
      orderBy: [{ status: "asc" }, { openedAt: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: ticketInclude,
    }),
    prisma.maintenanceTicket.count({ where }),
  ]);
  return { items, page: q.page, pageSize: q.pageSize, total };
}

async function serviceableAsset(db: Db, assetId: string) {
  const asset = await db.asset.findUnique({ where: { id: assetId }, include: { type: true } });
  if (!asset) throw notFound("Asset");
  if (!SERVICEABLE.includes(asset.status)) {
    throw new AppError(409, "ASSET_NOT_IN_SERVICE", "Tickets can only be opened for assets that are in operation or under maintenance.");
  }
  return asset;
}

export async function createTicket(data: CreateTicketBody, userId: string) {
  return prisma.$transaction(async (tx) => {
    await serviceableAsset(tx, data.assetId);
    const ticket = await tx.maintenanceTicket.create({ data: { ...data, createdById: userId } });
    await writeAudit(tx, { entity: "MaintenanceTicket", entityId: ticket.id, action: "CREATE", userId, changes: { after: data } });
    return ticket;
  });
}

export async function updateTicket(id: string, data: UpdateTicketBody, userId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.maintenanceTicket.findUnique({ where: { id } });
    if (!before) throw notFound("Ticket");
    if (before.status === "CLOSED") throw new AppError(409, "TICKET_CLOSED", "This ticket is already closed.");
    const after = await tx.maintenanceTicket.update({ where: { id }, data, include: ticketInclude });
    await writeAudit(tx, {
      entity: "MaintenanceTicket",
      entityId: id,
      action: "UPDATE",
      userId,
      changes: { before: { status: before.status, assignedToId: before.assignedToId, priority: before.priority }, after: data },
    });
    return after;
  });
}

/** Record that maintenance was done: last = now, next = now + interval. */
async function markServiced(tx: Db, assetId: string, intervalDays: number | null) {
  const now = new Date();
  await tx.asset.update({
    where: { id: assetId },
    data: {
      lastMaintenanceDate: now,
      nextMaintenanceDate: intervalDays ? new Date(now.getTime() + intervalDays * DAY_MS) : null,
    },
  });
}

/**
 * Close a ticket (CLAUDE.md 6.1). In one transaction:
 * - close the ticket, mark its public report FIXED
 * - if it was the asset's last open ticket and the asset is under maintenance,
 *   ask the lifecycle engine to move it back to IN_OPERATION (never set status here)
 * - update last/next maintenance dates
 */
export function closeTicket(id: string, data: CloseTicketBody, user: AuthUser, tx?: Db) {
  return tx ? runClose(tx, id, data, user) : prisma.$transaction((t) => runClose(t, id, data, user));
}

async function runClose(tx: Db, id: string, data: CloseTicketBody, user: AuthUser) {
  const ticket = await tx.maintenanceTicket.findUnique({ where: { id } });
  if (!ticket) throw notFound("Ticket");
  if (ticket.status === "CLOSED") throw new AppError(409, "TICKET_CLOSED", "This ticket is already closed.");

  const closed = await tx.maintenanceTicket.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date(), resolutionNote: data.resolutionNote, cost: data.cost },
  });
  await writeAudit(tx, { entity: "MaintenanceTicket", entityId: id, action: "CLOSE", userId: user.id, changes: { ...data } });

  if (ticket.sourceReportId) {
    await tx.citizenReport.update({ where: { id: ticket.sourceReportId }, data: { status: "FIXED" } });
  }

  const asset = await tx.asset.findUniqueOrThrow({ where: { id: ticket.assetId }, include: { type: true } });
  const stillOpen = await tx.maintenanceTicket.count({ where: { assetId: asset.id, ...OPEN_TICKET } });

  let assetReturnedToOperation = false;
  if (stillOpen === 0 && asset.status === "UNDER_MAINTENANCE") {
    await transitionAsset(
      { assetId: asset.id, toStatus: "IN_OPERATION", userId: user.id, role: user.role, source: "TICKET", note: `Repair finished: ${data.resolutionNote}` },
      tx,
    );
    assetReturnedToOperation = true;
  }
  if (assetReturnedToOperation || ticket.kind === "PREVENTIVE") {
    await markServiced(tx, asset.id, asset.type.maintenanceIntervalDays);
  }

  return { ticket: closed, assetReturnedToOperation };
}

/** "Log a service": a PREVENTIVE ticket created and closed at once. Status does not change. */
export async function logService(data: LogServiceBody, user: AuthUser) {
  return prisma.$transaction(async (tx) => {
    await serviceableAsset(tx, data.assetId);
    const ticket = await tx.maintenanceTicket.create({
      data: { assetId: data.assetId, kind: "PREVENTIVE", description: "Routine service", createdById: user.id, assignedToId: user.id },
    });
    return closeTicket(ticket.id, { resolutionNote: data.resolutionNote, cost: data.cost }, user, tx);
  });
}
