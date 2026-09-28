import { Router } from "express";
import multer from "multer";
import { AppError } from "../../lib/AppError";
import { reportLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import { assetCodeParams, createReportBody, nearbyQuery, trackingParams } from "./public.schema";
import * as service from "./public.service";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Photos: memory only (stored in Postgres, never on disk), max 2 MB, images only.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(400, "INVALID_PHOTO", "The photo must be a JPEG, PNG or WebP image."));
  },
});

// Mounted at /api/public with publicReadLimiter. No login.
// Nothing here can change an asset; the only write is a report into the staff queue.
export const publicRouter = Router();

// Registered before "/assets/:assetCode" so "nearby" is not read as a code.
publicRouter.get("/assets/nearby", validate({ query: nearbyQuery }), async (req, res) => {
  const { lat, lng } = req.query as unknown as { lat: number; lng: number };
  res.json(await service.nearbyAssets(lat, lng));
});

publicRouter.get("/assets/:assetCode", validate({ params: assetCodeParams }), async (req, res) => {
  res.json(await service.getPublicAsset(req.params.assetCode as string));
});

publicRouter.post(
  "/reports",
  reportLimiter,
  upload.single("photo"),
  validate({ body: createReportBody }),
  async (req, res) => {
    const photo = req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : undefined;
    res.status(201).json(await service.createReport(req.body, photo));
  },
);

publicRouter.get("/reports/:trackingCode", validate({ params: trackingParams }), async (req, res) => {
  res.json(await service.trackReport(req.params.trackingCode as string));
});
