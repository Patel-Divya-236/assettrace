import { z } from "zod";

export const REPORT_CATEGORIES = ["NOT_WORKING", "BROKEN", "LEAKING", "OTHER"] as const;

export const assetCodeParams = z.object({
  assetCode: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2,4}-\d{6}$/, "Asset number looks like SL-000142")),
});

export const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// Multipart form fields arrive as strings.
export const createReportBody = z.object({
  assetCode: assetCodeParams.shape.assetCode,
  category: z.enum(REPORT_CATEGORIES),
  note: z.string().trim().max(500).optional().transform((s) => s || undefined),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((s) => s || undefined)
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number").optional()),
  language: z.enum(["gu", "hi", "en"]).default("en"),
});

export const trackingParams = z.object({
  trackingCode: z.string().regex(/^\d{6}$/, "Tracking number has 6 digits"),
});

export type CreateReportBody = z.infer<typeof createReportBody>;
