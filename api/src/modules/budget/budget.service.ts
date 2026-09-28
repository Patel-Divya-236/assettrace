import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import type { Db } from "../../lib/audit";

export const DEFAULT_APPROVAL_LIMIT = 50_000;

/** Indian financial year starts in April: Sep 2026 -> 2026 (FY 2026-27). */
export function financialYear(date = new Date()) {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}
const fyRange = (year: number) => [new Date(year, 3, 1), new Date(year + 1, 3, 1)] as const;

export async function getApprovalLimit(db: Db = prisma) {
  const row = await db.setting.findUnique({ where: { key: "approvalLimit" } });
  return row ? Number(row.value) : DEFAULT_APPROVAL_LIMIT;
}

export async function setApprovalLimit(value: number) {
  await prisma.setting.upsert({ where: { key: "approvalLimit" }, update: { value: String(value) }, create: { key: "approvalLimit", value: String(value) } });
  return { approvalLimit: value };
}

type Row = { ward: string; allocated: number; committed: number; spent: number };

/**
 * Per ward for one financial year, computed in SQL (no rows loaded into memory):
 * - allocated: the budget set by the admin
 * - committed: estimates of inspected tickets that are still open
 * - spent: actual cost of tickets closed in this financial year
 */
export async function budgetSummary(year = financialYear(), db: Db = prisma) {
  const [from, to] = fyRange(year);
  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    WITH wards AS (
      SELECT ward FROM "Budget" WHERE year = ${year}
      UNION SELECT DISTINCT ward FROM "Asset" WHERE ward IS NOT NULL
    ),
    committed AS (
      SELECT a.ward, SUM(t."estimatedCost") AS amount
      FROM "MaintenanceTicket" t JOIN "Asset" a ON a.id = t."assetId"
      WHERE t.status <> 'CLOSED' AND t."estimatedCost" IS NOT NULL
      GROUP BY a.ward
    ),
    spent AS (
      SELECT a.ward, SUM(t.cost) AS amount
      FROM "MaintenanceTicket" t JOIN "Asset" a ON a.id = t."assetId"
      WHERE t.status = 'CLOSED' AND t."closedAt" >= ${from} AND t."closedAt" < ${to}
      GROUP BY a.ward
    )
    SELECT w.ward,
      COALESCE(b.amount, 0)::float AS allocated,
      COALESCE(c.amount, 0)::float AS committed,
      COALESCE(s.amount, 0)::float AS spent
    FROM wards w
    LEFT JOIN "Budget" b ON b.ward = w.ward AND b.year = ${year}
    LEFT JOIN committed c ON c.ward = w.ward
    LEFT JOIN spent s ON s.ward = w.ward
    ORDER BY w.ward`);
  return {
    year,
    approvalLimit: await getApprovalLimit(db),
    items: rows.map((r) => ({ ...r, remaining: r.allocated - r.committed - r.spent })),
  };
}

export async function wardRemaining(ward: string | null, db: Db) {
  if (!ward) return null;
  const s = await budgetSummary(financialYear(), db);
  const row = s.items.find((r) => r.ward === ward);
  return row && row.allocated > 0 ? row.remaining : null; // null = no budget set for this ward
}

export async function setBudget(ward: string, year: number, amount: number) {
  return prisma.budget.upsert({ where: { ward_year: { ward, year } }, update: { amount }, create: { ward, year, amount } });
}
