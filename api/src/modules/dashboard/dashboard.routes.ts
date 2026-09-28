import { Router } from "express";
import { getSummary } from "./dashboard.service";

// Mounted at /api/dashboard behind requireAuth (all staff roles).
export const dashboardRouter = Router();

dashboardRouter.get("/summary", async (_req, res) => {
  res.json(await getSummary());
});
