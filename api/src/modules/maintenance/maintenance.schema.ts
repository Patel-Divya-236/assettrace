import { TicketKind, TicketPriority } from "@prisma/client";
import { z } from "zod";
import { paginationQuery } from "../../middleware/validate";

export const listTicketsQuery = paginationQuery.extend({
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED", "ACTIVE"]).optional(), // ACTIVE = OPEN or IN_PROGRESS
  kind: z.enum(TicketKind).optional(),
  assetId: z.uuid().optional(),
});

export const createTicketBody = z.object({
  assetId: z.uuid(),
  kind: z.enum(TicketKind),
  priority: z.enum(TicketPriority).default("MEDIUM"),
  description: z.string().trim().max(1000).optional(),
  assignedToId: z.uuid().optional(),
});

// Closing has its own endpoint because it has side effects on the asset.
export const updateTicketBody = z.strictObject({
  status: z.enum(["OPEN", "IN_PROGRESS"]).optional(),
  assignedToId: z.uuid().nullable().optional(),
  priority: z.enum(TicketPriority).optional(),
});

export const closeTicketBody = z.object({
  resolutionNote: z.string().trim().min(2, "Write what was done, e.g. 'Replaced motor capacitor'"),
  cost: z.coerce.number().min(0).optional(),
});

// "Log a service": record preventive maintenance that is already done.
export const logServiceBody = closeTicketBody.extend({ assetId: z.uuid() });

export type ListTicketsQuery = z.infer<typeof listTicketsQuery>;
export type CreateTicketBody = z.infer<typeof createTicketBody>;
export type UpdateTicketBody = z.infer<typeof updateTicketBody>;
export type CloseTicketBody = z.infer<typeof closeTicketBody>;
export type LogServiceBody = z.infer<typeof logServiceBody>;
