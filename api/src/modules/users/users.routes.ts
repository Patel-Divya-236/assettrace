import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";

// Mounted at /api/users behind requireAuth. Admins use it to pick who does a repair.
export const usersRouter = Router();

const listUsersQuery = z.object({ role: z.enum(Role).optional() });

usersRouter.get("/", requireRole("ADMIN", "OFFICER"), validate({ query: listUsersQuery }), async (req, res) => {
  const { role } = req.query as z.infer<typeof listUsersQuery>;
  // Small list (staff accounts), so no pagination; only safe fields.
  const items = await prisma.user.findMany({
    where: role ? { role } : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
    take: 500,
  });
  res.json({ items });
});
