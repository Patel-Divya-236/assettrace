// Field work on a repair ticket (C2 + C3):
// inspect on site -> (officer approval if needed) -> assign contractor -> progress updates -> close.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { AppError, notFound } from "../../lib/AppError";
import { writeAudit } from "../../lib/audit";
import { currentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { idParams, validate } from "../../middleware/validate";
import { getApprovalLimit, wardRemaining } from "../budget/budget.service";

export const workflowRouter = Router();
const fieldStaff = requireRole("ADMIN", "OFFICER", "FIELD_OFFICER");

async function openTicket(id: string) {
  const t = await prisma.maintenanceTicket.findUnique({ where: { id }, include: { asset: { select: { ward: true } } } });
  if (!t) throw notFound("Ticket");
  if (t.status === "CLOSED") throw new AppError(409, "TICKET_CLOSED", "This ticket is already closed.");
  return t;
}

/** Field officer visits the site: findings + estimated cost. Decides if officer approval is needed. */
workflowRouter.post(
  "/:id/inspect",
  fieldStaff,
  validate({ params: idParams, body: z.object({ note: z.string().trim().min(3, "Write what you found on site"), estimatedCost: z.number().min(0) }) }),
  async (req, res) => {
    const user = currentUser(req);
    const t = await openTicket(req.params.id as string);
    const { note, estimatedCost } = req.body as { note: string; estimatedCost: number };

    const limit = await getApprovalLimit();
    // Remaining budget before this ticket's own (possibly earlier) estimate is counted.
    const remaining = await wardRemaining(t.asset.ward, prisma);
    const available = remaining === null ? null : remaining + Number(t.estimatedCost ?? 0);
    const reasons: string[] = [];
    if (estimatedCost > limit) reasons.push(`Estimate ₹${estimatedCost} is above the approval limit ₹${limit}.`);
    if (available !== null && estimatedCost > available) reasons.push(`Estimate is more than the ward's remaining budget ₹${Math.max(0, Math.round(available))}.`);

    const updated = await prisma.maintenanceTicket.update({
      where: { id: t.id },
      data: {
        inspectionNote: note,
        inspectedAt: new Date(),
        inspectedById: user.id,
        estimatedCost,
        needsApproval: reasons.length > 0,
        approvalReason: reasons.join(" ") || null,
        approvedById: null,
        approvedAt: null,
      },
    });
    await writeAudit(prisma, { entity: "MaintenanceTicket", entityId: t.id, action: "INSPECT", userId: user.id, changes: { note, estimatedCost, needsApproval: reasons.length > 0 } });
    res.json(updated);
  },
);

/** Officer or admin approves a cost that is above the limit or over budget. */
workflowRouter.post("/:id/approve", requireRole("ADMIN", "OFFICER"), validate({ params: idParams }), async (req, res) => {
  const user = currentUser(req);
  const t = await openTicket(req.params.id as string);
  if (!t.needsApproval) throw new AppError(409, "NO_APPROVAL_NEEDED", "This ticket does not need approval.");
  const updated = await prisma.maintenanceTicket.update({ where: { id: t.id }, data: { approvedById: user.id, approvedAt: new Date() } });
  await writeAudit(prisma, { entity: "MaintenanceTicket", entityId: t.id, action: "APPROVE", userId: user.id, changes: { estimatedCost: Number(t.estimatedCost) } });
  res.json(updated);
});

/** Assign a contractor. Only after inspection, and after approval when it was needed. */
workflowRouter.post(
  "/:id/contractor",
  fieldStaff,
  validate({ params: idParams, body: z.object({ contractorId: z.uuid() }) }),
  async (req, res) => {
    const user = currentUser(req);
    const t = await openTicket(req.params.id as string);
    if (!t.inspectedAt) throw new AppError(409, "INSPECTION_REQUIRED", "Inspect the site and record an estimate before assigning a contractor.");
    if (t.needsApproval && !t.approvedAt) throw new AppError(409, "APPROVAL_REQUIRED", "An officer must approve this cost before a contractor is assigned.");
    const c = await prisma.contractor.findUnique({ where: { id: req.body.contractorId } });
    if (!c) throw new AppError(400, "INVALID_CONTRACTOR", "Contractor not found.");
    const updated = await prisma.maintenanceTicket.update({ where: { id: t.id }, data: { contractorId: c.id, status: "IN_PROGRESS" } });
    await prisma.ticketUpdate.create({ data: { ticketId: t.id, note: `Assigned to ${c.name}${c.firm ? ` (${c.firm})` : ""}`, progress: 0, createdById: user.id } });
    await writeAudit(prisma, { entity: "MaintenanceTicket", entityId: t.id, action: "ASSIGN_CONTRACTOR", userId: user.id, changes: { contractorId: c.id } });
    res.json(updated);
  },
);

/** The contractor reports progress (by phone/on site); the field officer records it. */
workflowRouter.post(
  "/:id/updates",
  fieldStaff,
  validate({ params: idParams, body: z.object({ note: z.string().trim().min(2), progress: z.number().int().min(0).max(100).optional() }) }),
  async (req, res) => {
    const user = currentUser(req);
    const t = await openTicket(req.params.id as string);
    if (!t.contractorId) throw new AppError(409, "CONTRACTOR_REQUIRED", "Assign a contractor first.");
    const u = await prisma.ticketUpdate.create({ data: { ticketId: t.id, note: req.body.note, progress: req.body.progress, createdById: user.id } });
    res.status(201).json(u);
  },
);
