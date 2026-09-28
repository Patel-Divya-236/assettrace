import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { AssetStatus, type Prisma } from "@prisma/client";
import { parse } from "csv-parse";
import { prisma } from "../../db/prisma";
import { reserveAssetCodes } from "../../lib/assetCode";
import { AppError, notFound } from "../../lib/AppError";
import { type FieldDef, validateAttributes } from "../../lib/attributes";
import { writeAudit } from "../../lib/audit";

const BATCH_SIZE = 500;
const MAX_STORED_ERRORS = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

// Fixed columns; every other column is a custom field key of the asset type.
const BASE_COLUMNS = ["name", "lat", "lng", "locationText", "ward", "status", "condition"];
const REQUIRED_COLUMNS = ["name", "lat", "lng", "locationText"];

type RowError = { row: number; message: string };
type Row = Record<string, string>;

/** Turn one CSV row into asset data, or throw a plain-language message. */
function parseRow(row: Row, fields: FieldDef[]) {
  for (const col of REQUIRED_COLUMNS) {
    if (!row[col]?.trim()) throw new Error(`"${col}" is empty`);
  }
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`lat "${row.lat}" is not a valid latitude`);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(`lng "${row.lng}" is not a valid longitude`);

  // Imported registers usually list assets that already run (D-20).
  const status = (row.status?.trim().toUpperCase() || "IN_OPERATION") as AssetStatus;
  if (!Object.values(AssetStatus).includes(status)) throw new Error(`status "${row.status}" is not a lifecycle stage`);

  let condition: number | null = null;
  if (row.condition?.trim()) {
    condition = Number(row.condition);
    if (!Number.isInteger(condition) || condition < 1 || condition > 5) throw new Error("condition must be 1 to 5");
  }

  // Empty cells mean "not provided", so blank optional columns are fine.
  const custom = Object.fromEntries(Object.entries(row).filter(([k, v]) => !BASE_COLUMNS.includes(k) && v !== ""));
  let attributes;
  try {
    attributes = validateAttributes(fields, custom);
  } catch (err) {
    const problems = (err as AppError).details?.fields as Record<string, string> | undefined;
    throw new Error(problems ? Object.entries(problems).map(([k, m]) => `${k}: ${m}`).join("; ") : "invalid custom fields");
  }

  return {
    name: row.name.trim(),
    lat,
    lng,
    locationText: row.locationText.trim(),
    ward: row.ward?.trim() || null,
    status,
    condition,
    attributes,
  };
}

type ParsedRow = ReturnType<typeof parseRow>;

/** Insert one batch: reserve codes once, createMany assets + their first lifecycle events. */
async function insertBatch(batch: ParsedRow[], typeId: string, intervalDays: number | null, userId: string) {
  await prisma.$transaction(async (tx) => {
    const codes = await reserveAssetCodes(tx, typeId, batch.length);
    const now = Date.now();
    const assets = batch.map((r, i) => ({
      ...r,
      id: randomUUID(),
      typeId,
      assetCode: codes[i],
      nextMaintenanceDate:
        intervalDays && (r.status === "IN_OPERATION" || r.status === "UNDER_MAINTENANCE")
          ? new Date(now + intervalDays * DAY_MS)
          : null,
    }));
    await tx.asset.createMany({ data: assets });
    await tx.lifecycleEvent.createMany({
      data: assets.map((a) => ({ assetId: a.id, fromStatus: null, toStatus: a.status, userId, note: "Imported from CSV" })),
    });
  });
}

/**
 * Stream-parse the CSV and insert valid rows in batches of 500.
 * Streaming means we never hold the whole file as objects in memory, and each
 * awaited batch insert gives Node's single thread back to other requests.
 */
export async function runImport(file: Buffer, typeId: string, userId: string) {
  const type = await prisma.assetType.findUnique({ where: { id: typeId } });
  if (!type) throw new AppError(400, "INVALID_TYPE", "The asset type was not found.");
  const fields = type.fields as FieldDef[];

  const job = await prisma.importJob.create({ data: { typeId, createdById: userId, status: "RUNNING" } });
  const errors: RowError[] = [];
  let total = 0;
  let succeeded = 0;
  let batch: ParsedRow[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await insertBatch(batch, typeId, type.maintenanceIntervalDays, userId);
    succeeded += batch.length;
    batch = [];
    await prisma.importJob.update({ where: { id: job.id }, data: { total, succeeded, failed: total - succeeded } });
  };

  try {
    const parser = Readable.from(file).pipe(parse({ columns: true, trim: true, skip_empty_lines: true, bom: true }));
    let checkedHeader = false;
    for await (const row of parser as AsyncIterable<Row>) {
      if (!checkedHeader) {
        const missing = REQUIRED_COLUMNS.filter((c) => !(c in row));
        if (missing.length) throw new AppError(400, "INVALID_CSV", `The CSV is missing these columns: ${missing.join(", ")}. Download the template and try again.`);
        checkedHeader = true;
      }
      total++;
      try {
        batch.push(parseRow(row, fields));
      } catch (err) {
        // +1 for the header line, so the number matches what the user sees in Excel.
        if (errors.length < MAX_STORED_ERRORS) errors.push({ row: total + 1, message: (err as Error).message });
      }
      if (batch.length >= BATCH_SIZE) await flush();
    }
    await flush();
  } catch (err) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "FAILED", total, succeeded, failed: total - succeeded, errors: errors as Prisma.InputJsonValue, finishedAt: new Date() },
    });
    if (err instanceof AppError) throw err;
    throw new AppError(400, "INVALID_CSV", "The file could not be read as CSV. Save it from Excel as 'CSV UTF-8' and try again.");
  }

  const done = await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "DONE", total, succeeded, failed: total - succeeded, errors: errors as Prisma.InputJsonValue, finishedAt: new Date() },
  });
  // One audit row per import, not one per asset.
  await writeAudit(prisma, { entity: "ImportJob", entityId: job.id, action: "IMPORT", userId, changes: { typeId, total, succeeded } });
  return done;
}

export async function getImportJob(id: string) {
  const job = await prisma.importJob.findUnique({ where: { id }, include: { type: { select: { name: true } } } });
  if (!job) throw notFound("Import job");
  return job;
}
