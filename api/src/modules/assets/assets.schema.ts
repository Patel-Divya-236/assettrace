import { AssetStatus } from "@prisma/client";
import { z } from "zod";
import { paginationQuery } from "../../middleware/validate";

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const createAssetBody = z.object({
  typeId: z.uuid(),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  lat,
  lng,
  locationText: z.string().trim().min(2, "Describe the location, e.g. 'Sector 21, near bus stand'"),
  ward: z.string().trim().min(1).optional(),
  parentId: z.uuid().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  condition: z.number().int().min(1).max(5).optional(),
});

// Status is deliberately not here: it only changes through POST /:id/transition.
export const updateAssetBody = z.strictObject({
  name: createAssetBody.shape.name.optional(),
  lat: lat.optional(),
  lng: lng.optional(),
  locationText: createAssetBody.shape.locationText.optional(),
  ward: z.string().trim().min(1).nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  condition: z.number().int().min(1).max(5).nullable().optional(),
});

export const listAssetsQuery = paginationQuery.extend({
  typeId: z.uuid().optional(),
  status: z.enum(AssetStatus).optional(),
  ward: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  overdue: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

// bbox = "minLng,minLat,maxLng,maxLat" (the order Leaflet's toBBoxString() uses)
export const mapQuery = z.object({
  bbox: z
    .string()
    .transform((s) => s.split(",").map(Number))
    .refine((n) => n.length === 4 && n.every(Number.isFinite), "bbox must be minLng,minLat,maxLng,maxLat"),
  typeId: z.uuid().optional(),
  status: z.enum(AssetStatus).optional(),
});

export type CreateAssetBody = z.infer<typeof createAssetBody>;
export type UpdateAssetBody = z.infer<typeof updateAssetBody>;
export type ListAssetsQuery = z.infer<typeof listAssetsQuery>;
export type MapQuery = z.infer<typeof mapQuery>;
