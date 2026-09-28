import { Router } from "express";
import { currentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { idParams, validate } from "../../middleware/validate";
import {
  closeTicketBody,
  createTicketBody,
  type ListTicketsQuery,
  listTicketsQuery,
  logServiceBody,
  updateTicketBody,
} from "./maintenance.schema";
import * as service from "./maintenance.service";

// Mounted at /api/tickets behind requireAuth. Viewers can read; officers and admins act.
export const maintenanceRouter = Router();
const canAct = requireRole("ADMIN", "FIELD_OFFICER");

maintenanceRouter.get("/", validate({ query: listTicketsQuery }), async (req, res) => {
  res.json(await service.listTickets(req.query as unknown as ListTicketsQuery));
});

maintenanceRouter.post("/", canAct, validate({ body: createTicketBody }), async (req, res) => {
  res.status(201).json(await service.createTicket(req.body, currentUser(req).id));
});

// Before "/:id" routes so "service" is not read as an id.
maintenanceRouter.post("/service", canAct, validate({ body: logServiceBody }), async (req, res) => {
  res.status(201).json(await service.logService(req.body, currentUser(req)));
});

maintenanceRouter.patch("/:id", canAct, validate({ params: idParams, body: updateTicketBody }), async (req, res) => {
  res.json(await service.updateTicket(req.params.id as string, req.body, currentUser(req).id));
});

maintenanceRouter.post("/:id/close", canAct, validate({ params: idParams, body: closeTicketBody }), async (req, res) => {
  res.json(await service.closeTicket(req.params.id as string, req.body, currentUser(req)));
});
