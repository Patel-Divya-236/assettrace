import { Router } from "express";
import { AppError } from "../../lib/AppError";
import { currentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { idParams, validate } from "../../middleware/validate";
import {
  createAssetBody,
  type ListAssetsQuery,
  listAssetsQuery,
  type MapQuery,
  mapQuery,
  updateAssetBody,
} from "./assets.schema";
import * as service from "./assets.service";

// Mounted at /api/assets behind requireAuth.
export const assetsRouter = Router();

assetsRouter.get("/", validate({ query: listAssetsQuery }), async (req, res) => {
  res.json(await service.listAssets(req.query as unknown as ListAssetsQuery));
});

// Registered before "/:id" so "map" is not treated as an id.
assetsRouter.get("/map", validate({ query: mapQuery }), async (req, res) => {
  res.json(await service.mapAssets(req.query as unknown as MapQuery));
});

assetsRouter.post("/", requireRole("ADMIN"), validate({ body: createAssetBody }), async (req, res) => {
  res.status(201).json(await service.createAsset(req.body, currentUser(req).id));
});

assetsRouter.get("/:id", validate({ params: idParams }), async (req, res) => {
  res.json(await service.getAsset(req.params.id as string, currentUser(req).role));
});

assetsRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  // Clear message instead of a generic "unknown field" when someone tries to set status here.
  (req, _res, next) => {
    if (req.body && "status" in req.body) {
      throw new AppError(
        400,
        "USE_TRANSITION_ENDPOINT",
        "Status can't be edited directly. Use POST /api/assets/:id/transition so the change is checked and recorded.",
      );
    }
    next();
  },
  validate({ params: idParams, body: updateAssetBody }),
  async (req, res) => {
    res.json(await service.updateAsset(req.params.id as string, req.body, currentUser(req).id));
  },
);
