import { Router } from "express";
import { currentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { idParams, validate } from "../../middleware/validate";
import {
  createAssetTypeBody,
  listAssetTypesQuery,
  updateAssetTypeBody,
} from "./assetTypes.schema";
import * as service from "./assetTypes.service";

// Mounted at /api/asset-types behind requireAuth (any staff role can read).
export const assetTypesRouter = Router();

assetTypesRouter.get("/", validate({ query: listAssetTypesQuery }), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  res.json(await service.listAssetTypes(page, pageSize));
});

assetTypesRouter.get("/:id", validate({ params: idParams }), async (req, res) => {
  res.json(await service.getAssetType(req.params.id as string));
});

assetTypesRouter.post(
  "/",
  requireRole("ADMIN"),
  validate({ body: createAssetTypeBody }),
  async (req, res) => {
    res.status(201).json(await service.createAssetType(req.body, currentUser(req).id));
  },
);

assetTypesRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  validate({ params: idParams, body: updateAssetTypeBody }),
  async (req, res) => {
    res.json(await service.updateAssetType(req.params.id as string, req.body, currentUser(req).id));
  },
);
