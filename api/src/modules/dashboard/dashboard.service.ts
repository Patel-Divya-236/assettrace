import { prisma } from "../../db/prisma";
import { OPEN_TICKET } from "../assets/assets.service";

// Overdue = scheduled service date has passed on an asset that is still in service.
const overdueWhere = () => ({
  nextMaintenanceDate: { lt: new Date() },
  status: { in: ["IN_OPERATION" as const, "UNDER_MAINTENANCE" as const] },
});

/**
 * Everything the dashboard needs, computed with COUNT / GROUP BY in the database.
 * No asset rows are loaded into memory except the top-5 list.
 */
export async function getSummary() {
  const [total, byStatus, byTypeRaw, byCondition, overdue, openTickets, newReports, topOverdue, types] =
    await Promise.all([
      prisma.asset.count(),
      prisma.asset.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.asset.groupBy({ by: ["typeId"], _count: { _all: true } }),
      prisma.asset.groupBy({ by: ["condition"], _count: { _all: true } }),
      prisma.asset.count({ where: overdueWhere() }),
      prisma.maintenanceTicket.count({ where: OPEN_TICKET }),
      prisma.citizenReport.count({ where: { status: "RECEIVED" } }),
      prisma.asset.findMany({
        where: overdueWhere(),
        orderBy: { nextMaintenanceDate: "asc" },
        take: 5,
        select: {
          id: true,
          assetCode: true,
          name: true,
          status: true,
          locationText: true,
          nextMaintenanceDate: true,
          type: { select: { name: true, icon: true } },
        },
      }),
      prisma.assetType.findMany({ select: { id: true, name: true, icon: true } }),
    ]);

  const typeById = new Map(types.map((t) => [t.id, t]));
  return {
    totalAssets: total,
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    byType: byTypeRaw
      .map((r) => ({ typeId: r.typeId, name: typeById.get(r.typeId)?.name ?? "?", icon: typeById.get(r.typeId)?.icon ?? null, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
    byCondition: byCondition
      .map((r) => ({ condition: r.condition, count: r._count._all }))
      .sort((a, b) => (a.condition ?? 0) - (b.condition ?? 0)),
    overdueMaintenance: overdue,
    openTickets,
    newPublicReports: newReports,
    topOverdue,
  };
}
