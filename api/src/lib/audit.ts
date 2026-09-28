import type { Prisma, PrismaClient } from "@prisma/client";

// Works with the normal client or inside prisma.$transaction(async (tx) => ...),
// so the audit row is saved together with the change it describes.
export type Db = PrismaClient | Prisma.TransactionClient;

type AuditEntry = {
  entity: string; // "Asset", "AssetType", "MaintenanceTicket", ...
  entityId: string;
  action: string; // "CREATE", "UPDATE", "TRANSITION", ...
  userId?: string | null;
  changes?: Prisma.InputJsonValue;
};

// Insert-only. There is no update or delete for audit rows anywhere.
export function writeAudit(db: Db, entry: AuditEntry) {
  return db.auditLog.create({
    data: {
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId ?? null,
      changes: entry.changes ?? {},
    },
  });
}
