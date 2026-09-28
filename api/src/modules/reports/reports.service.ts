import type { Prisma, TicketPriority } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError, notFound } from "../../lib/AppError";
import { type Db, writeAudit } from "../../lib/audit";
import { canReport } from "../../lib/statusMap";
import type { AuthUser } from "../../middleware/auth";
import { transitionAsset } from "../lifecycle/lifecycle.service";
import type { ListReportsQuery } from "./reports.schema";

export async function listReports(q: ListReportsQuery) {
  const where: Prisma.CitizenReportWhereInput = q.status ? { status: q.status } : {};
  const [rows, total] = await prisma.$transaction([
    prisma.citizenReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      // Never the photo bytes in a list: fetched one at a time from /:id/photo.
      select: {
        id: true,
        category: true,
        note: true,
        phone: true,
        language: true,
        trackingCode: true,
        status: true,
        rejectReason: true,
        photoMime: true,
        createdAt: true,
        updatedAt: true,
        asset: { select: { id: true, assetCode: true, name: true, status: true, locationText: true, type: { select: { name: true, icon: true } } } },
        ticket: { select: { id: true, status: true } },
      },
    }),
    prisma.citizenReport.count({ where }),
  ]);
  const items = rows.map(({ photoMime, ...r }) => ({ ...r, hasPhoto: photoMime !== null }));
  return { items, page: q.page, pageSize: q.pageSize, total };
}

export async function getReportPhoto(id: string) {
  const report = await prisma.citizenReport.findUnique({ where: { id }, select: { photo: true, photoMime: true } });
  if (!report) throw notFound("Report");
  if (!report.photo || !report.photoMime) throw new AppError(404, "NO_PHOTO", "This report has no photo.");
  return { bytes: Buffer.from(report.photo), mime: report.photoMime };
}

async function receivedReport(tx: Db, id: string) {
  const report = await tx.citizenReport.findUnique({ where: { id }, include: { asset: true } });
  if (!report) throw notFound("Report");
  if (report.status !== "RECEIVED") {
    throw new AppError(409, "REPORT_ALREADY_HANDLED", "This report has already been confirmed or rejected.");
  }
  return report;
}

/**
 * Confirm a public report, in one transaction:
 * corrective ticket (linked to the report) -> report ASSIGNED ->
 * if the asset is working, the lifecycle engine moves it to UNDER_MAINTENANCE.
 */
export async function confirmReport(id: string, priority: TicketPriority, user: AuthUser) {
  return prisma.$transaction(async (tx) => {
    const report = await receivedReport(tx, id);
    if (!canReport(report.asset.status)) {
      throw new AppError(409, "ASSET_NOT_IN_SERVICE", "This asset is no longer in service. Reject the report with a reason instead.");
    }

    const ticket = await tx.maintenanceTicket.create({
      data: {
        assetId: report.assetId,
        kind: "CORRECTIVE",
        priority,
        description: `Public report ${report.trackingCode}: ${report.category}${report.note ? ` - ${report.note}` : ""}`,
        createdById: user.id,
        sourceReportId: report.id,
      },
    });
    await tx.citizenReport.update({ where: { id }, data: { status: "ASSIGNED" } });

    if (report.asset.status === "IN_OPERATION") {
      await transitionAsset(
        {
          assetId: report.assetId,
          toStatus: "UNDER_MAINTENANCE",
          userId: user.id,
          role: user.role,
          source: "REPORT", // the ticket above is the repair ticket; don't create a second one
          note: `Public report ${report.trackingCode} confirmed`,
        },
        tx,
      );
    }

    await writeAudit(tx, { entity: "CitizenReport", entityId: id, action: "CONFIRM", userId: user.id, changes: { ticketId: ticket.id, priority } });
    return { reportId: id, status: "ASSIGNED" as const, ticketId: ticket.id };
  });
}

export async function rejectReport(id: string, reason: string, user: AuthUser) {
  return prisma.$transaction(async (tx) => {
    await receivedReport(tx, id);
    await tx.citizenReport.update({ where: { id }, data: { status: "REJECTED", rejectReason: reason } });
    await writeAudit(tx, { entity: "CitizenReport", entityId: id, action: "REJECT", userId: user.id, changes: { reason } });
    return { reportId: id, status: "REJECTED" as const };
  });
}
