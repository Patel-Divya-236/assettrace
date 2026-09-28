import { Router } from "express";
import { currentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { idParams, validate } from "../../middleware/validate";
import { getAsset } from "../assets/assets.service";
import { timelineQuery, transitionBody } from "./lifecycle.schema";
import { getTimeline, transitionAsset } from "./lifecycle.service";

// Mounted at /api/assets behind requireAuth.
export const lifecycleRouter = Router();

lifecycleRouter.post(
  "/:id/transition",
  requireRole("ADMIN", "FIELD_OFFICER"), // finer per-move rules live in lifecycle.rules.ts
  validate({ params: idParams, body: transitionBody }),
  async (req, res) => {
    const user = currentUser(req);
    const id = req.params.id as string;
    await transitionAsset({
      assetId: id,
      toStatus: req.body.toStatus,
      note: req.body.note,
      stageData: req.body.stageData,
      userId: user.id,
      role: user.role,
      source: "STAFF",
    });
    // Same shape as GET /:id, including the new allowedTransitions.
    res.json(await getAsset(id, user.role));
  },
);

lifecycleRouter.get(
  "/:id/timeline",
  validate({ params: idParams, query: timelineQuery }),
  async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    res.json(await getTimeline(req.params.id as string, page, pageSize));
  },
);
