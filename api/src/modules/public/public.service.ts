import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/AppError";
import { canReport, toPublicStatus } from "../../lib/statusMap";
import type { CreateReportBody } from "./public.schema";

// Only these fields ever leave the public API: no cost, vendor, notes, ids or user data.
const safeAssetSelect = {
  assetCode: true,
  status: true,
  locationText: true,
  ward: true,
  lastMaintenanceDate: true,
  type: { select: { name: true, icon: true } },
} satisfies Prisma.AssetSelect;

type SafeAsset = Prisma.AssetGetPayload<{ select: typeof safeAssetSelect }>;

function toPublicAsset(a: SafeAsset) {
  return {
    assetCode: a.assetCode,
    type: a.type,
    publicStatus: toPublicStatus(a.status),
    canReport: canReport(a.status),
    locationText: a.locationText,
    ward: a.ward,
    lastRepairedAt: a.lastMaintenanceDate,
  };
}

const notOnPlate = () =>
  new AppError(404, "ASSET_NOT_FOUND", "We could not find this asset. Check the number printed on the plate and try again.");

export async function getPublicAsset(assetCode: string) {
  const asset = await prisma.asset.findUnique({ where: { assetCode }, select: safeAssetSelect });
  if (!asset) throw notOnPlate();
  return toPublicAsset(asset);
}

const NEARBY_RADIUS_M = 1000;
const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in metres between two lat/lng points. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Up to 20 assets within ~1 km, nearest first.
 * Step 1: a lat/lng bounding box the (lat, lng) index can answer quickly.
 * Step 2: exact haversine distance on that small set, then sort and cut.
 */
export async function nearbyAssets(lat: number, lng: number) {
  const dLat = NEARBY_RADIUS_M / 111_320; // metres per degree of latitude
  const dLng = NEARBY_RADIUS_M / (111_320 * Math.cos((lat * Math.PI) / 180));

  const rows = await prisma.asset.findMany({
    where: {
      lat: { gte: lat - dLat, lte: lat + dLat },
      lng: { gte: lng - dLng, lte: lng + dLng },
      status: { notIn: ["PLANNED", "DISPOSED"] }, // not physically on the street
    },
    select: { ...safeAssetSelect, lat: true, lng: true },
    take: 1000,
  });

  return {
    items: rows
      .map((r) => ({ ...toPublicAsset(r), distanceMeters: Math.round(haversineMeters(lat, lng, r.lat, r.lng)) }))
      .filter((r) => r.distanceMeters <= NEARBY_RADIUS_M)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 20),
  };
}

type Photo = { buffer: Buffer; mimetype: string } | undefined;

export async function createReport(data: CreateReportBody, photo: Photo) {
  const asset = await prisma.asset.findUnique({ where: { assetCode: data.assetCode }, select: { id: true, status: true } });
  if (!asset) throw notOnPlate();
  if (!canReport(asset.status)) {
    throw new AppError(409, "ASSET_NOT_IN_SERVICE", "This asset is not in service, so problems can't be reported for it.");
  }

  // 6-digit codes are random (not guessable in order). Retry on the rare collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const trackingCode = String(randomInt(100000, 1000000));
    try {
      await prisma.citizenReport.create({
        data: {
          assetId: asset.id,
          category: data.category,
          note: data.note,
          phone: data.phone,
          language: data.language,
          trackingCode,
          photo: photo ? new Uint8Array(photo.buffer) : undefined,
          photoMime: photo?.mimetype,
        },
      });
      return { trackingCode };
    } catch (err) {
      const collision = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!collision) throw err;
    }
  }
  throw new AppError(503, "TRY_AGAIN", "Please try sending the report again.");
}

export async function trackReport(trackingCode: string) {
  const report = await prisma.citizenReport.findUnique({
    where: { trackingCode },
    // no phone, no photo, no ids
    select: {
      trackingCode: true,
      status: true,
      category: true,
      rejectReason: true,
      createdAt: true,
      updatedAt: true,
      asset: { select: { assetCode: true, type: { select: { name: true, icon: true } } } },
    },
  });
  if (!report) {
    throw new AppError(404, "REPORT_NOT_FOUND", "No complaint found with this number. Check the 6 digits and try again.");
  }
  const { asset, ...rest } = report;
  return { ...rest, assetCode: asset.assetCode, assetType: asset.type };
}
