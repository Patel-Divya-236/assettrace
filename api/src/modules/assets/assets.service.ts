import type { Prisma, Role } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { reserveAssetCodes } from "../../lib/assetCode";
import { AppError, notFound } from "../../lib/AppError";
import { type FieldDef, validateAttributes } from "../../lib/attributes";
import { type Db, writeAudit } from "../../lib/audit";
import { getAllowedTransitions } from "../lifecycle/lifecycle.rules";
import type { CreateAssetBody, ListAssetsQuery, MapQuery, UpdateAssetBody } from "./assets.schema";

export const MAP_LIMIT = 2000;
export const OPEN_TICKET = { status: { in: ["OPEN", "IN_PROGRESS"] } } satisfies Prisma.MaintenanceTicketWhereInput;

async function checkParent(db: Db, parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw new AppError(400, "INVALID_PARENT", "An asset cannot be its own parent.");
  const parent = await db.asset.findUnique({ where: { id: parentId }, select: { id: true } });
  if (!parent) throw new AppError(400, "INVALID_PARENT", "The parent asset was not found.");
}

export async function createAsset(data: CreateAssetBody, userId: string) {
  return prisma.$transaction(async (tx) => {
    const type = await tx.assetType.findUnique({ where: { id: data.typeId } });
    if (!type) throw new AppError(400, "INVALID_TYPE", "The asset type was not found.");

    const attributes = validateAttributes(type.fields as FieldDef[], data.attributes);
    await checkParent(tx, data.parentId);
    const [assetCode] = await reserveAssetCodes(tx, type.id);

    const asset = await tx.asset.create({
      data: { ...data, attributes, assetCode, status: "PLANNED" },
    });
    // Creation is not a transition (D-20): it sets the first status and starts the history.
    await tx.lifecycleEvent.create({
      data: { assetId: asset.id, fromStatus: null, toStatus: "PLANNED", userId, note: "Asset created" },
    });
    await writeAudit(tx, {
      entity: "Asset",
      entityId: asset.id,
      action: "CREATE",
      userId,
      changes: { after: { ...data, attributes, assetCode } },
    });
    return asset;
  });
}

function listWhere(q: ListAssetsQuery): Prisma.AssetWhereInput {
  const where: Prisma.AssetWhereInput = {};
  if (q.typeId) where.typeId = q.typeId;
  if (q.status) where.status = q.status;
  if (q.ward) where.ward = q.ward;
  if (q.overdue) where.nextMaintenanceDate = { lt: new Date() };
  if (q.q) {
    where.OR = [
      { assetCode: { contains: q.q, mode: "insensitive" } },
      { name: { contains: q.q, mode: "insensitive" } },
      { locationText: { contains: q.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listAssets(q: ListAssetsQuery) {
  const where = listWhere(q);
  const [items, total] = await prisma.$transaction([
    prisma.asset.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        assetCode: true,
        name: true,
        status: true,
        condition: true,
        locationText: true,
        ward: true,
        nextMaintenanceDate: true,
        updatedAt: true,
        type: { select: { id: true, name: true, codePrefix: true, icon: true } },
      },
    }),
    prisma.asset.count({ where }),
  ]);
  return { items, page: q.page, pageSize: q.pageSize, total };
}

// Minimal fields only, capped, so a phone never downloads 100k markers.
export async function mapAssets(q: MapQuery) {
  const [minLng, minLat, maxLng, maxLat] = q.bbox;
  const rows = await prisma.asset.findMany({
    where: {
      lat: { gte: minLat, lte: maxLat },
      lng: { gte: minLng, lte: maxLng },
      ...(q.typeId && { typeId: q.typeId }),
      ...(q.status && { status: q.status }),
    },
    select: { id: true, assetCode: true, typeId: true, status: true, lat: true, lng: true },
    take: MAP_LIMIT + 1, // one extra tells us whether the cap was hit
  });
  return { items: rows.slice(0, MAP_LIMIT), capped: rows.length > MAP_LIMIT, limit: MAP_LIMIT };
}

export async function getAsset(id: string, role: Role) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      type: true,
      parent: { select: { id: true, assetCode: true, name: true } },
      _count: { select: { tickets: { where: OPEN_TICKET }, children: true } },
    },
  });
  if (!asset) throw notFound("Asset");
  const { _count, ...rest } = asset;
  return {
    ...rest,
    openTicketCount: _count.tickets,
    childCount: _count.children,
    // Computed by the backend so the UI never decides lifecycle rules (D-05).
    allowedTransitions: getAllowedTransitions(asset.status, role, _count.tickets),
  };
}

export async function updateAsset(id: string, data: UpdateAssetBody, userId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.asset.findUnique({ where: { id }, include: { type: true } });
    if (!before) throw notFound("Asset");

    const { attributes, ...rest } = data;
    const update: Prisma.AssetUncheckedUpdateInput = { ...rest };
    if (attributes) {
      update.attributes = validateAttributes(before.type.fields as FieldDef[], attributes);
    }
    await checkParent(tx, data.parentId, id);

    const after = await tx.asset.update({ where: { id }, data: update });

    // Record only the fields that were sent, before and after.
    const keys = Object.keys(data) as (keyof UpdateAssetBody)[];
    const pick = (row: Record<string, unknown>) => Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));
    await writeAudit(tx, {
      entity: "Asset",
      entityId: id,
      action: "UPDATE",
      userId,
      changes: { before: pick(before), after: pick(after) } as Prisma.InputJsonValue,
    });
    return after;
  });
}
