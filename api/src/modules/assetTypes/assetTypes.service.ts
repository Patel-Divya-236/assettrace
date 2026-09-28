import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError, notFound } from "../../lib/AppError";
import type { FieldDef } from "../../lib/attributes";
import { writeAudit } from "../../lib/audit";
import type { CreateAssetTypeBody, UpdateAssetTypeBody } from "./assetTypes.schema";

export async function listAssetTypes(page: number, pageSize: number) {
  const [items, total] = await prisma.$transaction([
    prisma.assetType.findMany({
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { assets: true } } },
    }),
    prisma.assetType.count(),
  ]);
  return { items, page, pageSize, total };
}

export async function getAssetType(id: string) {
  const type = await prisma.assetType.findUnique({
    where: { id },
    include: { _count: { select: { assets: true } } },
  });
  if (!type) throw notFound("Asset type");
  return type;
}

export async function createAssetType(data: CreateAssetTypeBody, userId: string) {
  return prisma.$transaction(async (tx) => {
    const type = await tx.assetType.create({
      data: { ...data, fields: data.fields as Prisma.InputJsonValue },
    });
    await writeAudit(tx, {
      entity: "AssetType",
      entityId: type.id,
      action: "CREATE",
      userId,
      changes: { after: data as Prisma.InputJsonValue },
    });
    return type;
  });
}

/**
 * Once assets of a type exist, their stored attributes depend on the field list.
 * So we allow adding optional fields and renaming labels, but not removing a field,
 * changing its type, or adding a new required field (old assets would not have it).
 */
function checkFieldChanges(oldFields: FieldDef[], newFields: FieldDef[]) {
  const problems: Record<string, string> = {};
  const byKey = new Map(newFields.map((f) => [f.key, f]));
  const oldKeys = new Set(oldFields.map((f) => f.key));

  for (const old of oldFields) {
    const next = byKey.get(old.key);
    if (!next) problems[old.key] = `"${old.label}" cannot be removed because assets already use it.`;
    else if (next.type !== old.type) {
      problems[old.key] = `The type of "${old.label}" cannot change because assets already use it.`;
    }
  }
  for (const f of newFields) {
    if (!oldKeys.has(f.key) && f.required) {
      problems[f.key] = `New field "${f.label}" must be optional because existing assets do not have a value for it.`;
    }
  }

  if (Object.keys(problems).length > 0) {
    throw new AppError(
      409,
      "FIELDS_IN_USE",
      "Some field changes are not allowed because assets of this type already exist.",
      { fields: problems },
    );
  }
}

export async function updateAssetType(id: string, data: UpdateAssetTypeBody, userId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.assetType.findUnique({ where: { id } });
    if (!before) throw notFound("Asset type");

    if (data.fields) {
      const assetCount = await tx.asset.count({ where: { typeId: id } });
      if (assetCount > 0) checkFieldChanges(before.fields as FieldDef[], data.fields as FieldDef[]);
    }

    const after = await tx.assetType.update({
      where: { id },
      data: { ...data, fields: data.fields as Prisma.InputJsonValue | undefined },
    });
    await writeAudit(tx, {
      entity: "AssetType",
      entityId: id,
      action: "UPDATE",
      userId,
      changes: {
        before: { name: before.name, fields: before.fields, maintenanceIntervalDays: before.maintenanceIntervalDays },
        after: data as Prisma.InputJsonValue,
      },
    });
    return after;
  });
}
