import { Router } from "express";
import { validate } from "../../middleware/validate";
import { assetCodeParams, nearbyQuery, trackingParams } from "./public.schema";
import * as service from "./public.service";

// Mounted at /api/public with publicReadLimiter. No login.
// Read-only: nothing here changes data. Filing a complaint needs a citizen login (/api/citizen).
export const publicRouter = Router();

// Registered before "/assets/:assetCode" so "nearby" is not read as a code.
publicRouter.get("/assets/nearby", validate({ query: nearbyQuery }), async (req, res) => {
  const { lat, lng } = req.query as unknown as { lat: number; lng: number };
  res.json(await service.nearbyAssets(lat, lng));
});

publicRouter.get("/assets/:assetCode", validate({ params: assetCodeParams }), async (req, res) => {
  res.json(await service.getPublicAsset(req.params.assetCode as string));
});

publicRouter.get("/reports/:trackingCode", validate({ params: trackingParams }), async (req, res) => {
  res.json(await service.trackReport(req.params.trackingCode as string));
});
