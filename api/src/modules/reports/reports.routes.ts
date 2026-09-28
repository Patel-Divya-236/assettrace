import { Router } from "express";
import { currentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { idParams, validate } from "../../middleware/validate";
import { confirmReportBody, type ListReportsQuery, listReportsQuery, rejectReportBody } from "./reports.schema";
import * as service from "./reports.service";

// Mounted at /api/reports behind requireAuth. The queue is for admins and field officers.
export const reportsRouter = Router();
reportsRouter.use(requireRole("ADMIN", "FIELD_OFFICER"));

reportsRouter.get("/", validate({ query: listReportsQuery }), async (req, res) => {
  res.json(await service.listReports(req.query as unknown as ListReportsQuery));
});

reportsRouter.get("/:id/photo", validate({ params: idParams }), async (req, res) => {
  const { bytes, mime } = await service.getReportPhoto(req.params.id as string);
  res.type(mime).set("Cache-Control", "private, max-age=3600").send(bytes);
});

reportsRouter.post("/:id/confirm", validate({ params: idParams, body: confirmReportBody }), async (req, res) => {
  res.json(await service.confirmReport(req.params.id as string, req.body.priority, currentUser(req)));
});

reportsRouter.post("/:id/reject", validate({ params: idParams, body: rejectReportBody }), async (req, res) => {
  res.json(await service.rejectReport(req.params.id as string, req.body.reason, currentUser(req)));
});
