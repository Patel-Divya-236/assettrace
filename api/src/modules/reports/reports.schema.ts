import { ReportStatus, TicketPriority } from "@prisma/client";
import { z } from "zod";
import { paginationQuery } from "../../middleware/validate";

export const listReportsQuery = paginationQuery.extend({
  status: z.enum(ReportStatus).optional(),
});

export const confirmReportBody = z.object({
  priority: z.enum(TicketPriority).default("MEDIUM"),
});

export const rejectReportBody = z.object({
  reason: z.string().trim().min(3, "Write a short reason the citizen will see"),
});

export type ListReportsQuery = z.infer<typeof listReportsQuery>;
