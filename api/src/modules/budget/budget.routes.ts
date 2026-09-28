import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { writeAudit } from "../../lib/audit";
import { currentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { budgetSummary, financialYear, setApprovalLimit, setBudget } from "./budget.service";

// Mounted at /api behind requireAuth + requireStaff.
export const budgetRouter = Router();

budgetRouter.get("/budgets", validate({ query: z.object({ year: z.coerce.number().int().optional() }) }), async (req, res) => {
  const { year } = req.query as { year?: number };
  res.json(await budgetSummary(year ?? financialYear()));
});

budgetRouter.put(
  "/budgets",
  requireRole("ADMIN"),
  validate({ body: z.object({ ward: z.string().trim().min(1), year: z.number().int().optional(), amount: z.number().min(0) }) }),
  async (req, res) => {
    const { ward, year = financialYear(), amount } = req.body;
    const row = await setBudget(ward, year, amount);
    await writeAudit(prisma, { entity: "Budget", entityId: row.id, action: "SET", userId: currentUser(req).id, changes: { ward, year, amount } });
    res.json(row);
  },
);

budgetRouter.put(
  "/settings/approval-limit",
  requireRole("ADMIN"),
  validate({ body: z.object({ value: z.number().min(0) }) }),
  async (req, res) => {
    await writeAudit(prisma, { entity: "Setting", entityId: "approvalLimit", action: "SET", userId: currentUser(req).id, changes: { value: req.body.value } });
    res.json(await setApprovalLimit(req.body.value));
  },
);

// Contractors: records only, they never log in.
budgetRouter.get("/contractors", async (_req, res) => {
  res.json({ items: await prisma.contractor.findMany({ orderBy: { name: "asc" }, take: 500 }) });
});

budgetRouter.post(
  "/contractors",
  requireRole("ADMIN", "OFFICER"),
  validate({
    body: z.object({
      name: z.string().trim().min(2),
      firm: z.string().trim().optional(),
      phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
      workType: z.string().trim().optional(),
    }),
  }),
  async (req, res) => {
    const c = await prisma.contractor.create({ data: req.body });
    await writeAudit(prisma, { entity: "Contractor", entityId: c.id, action: "CREATE", userId: currentUser(req).id, changes: req.body });
    res.status(201).json(c);
  },
);
