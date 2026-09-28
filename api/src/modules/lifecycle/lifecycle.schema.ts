import { AssetStatus } from "@prisma/client";
import { z } from "zod";
import { paginationQuery } from "../../middleware/validate";

const date = z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), "Enter a valid date, e.g. 2024-03-31");
const money = z.coerce.number().min(0, "Amount can't be negative");

export const stageDataSchema = z.strictObject({
  acquiredDate: date.optional(),
  cost: money.optional(),
  vendor: z.string().trim().min(1).optional(),
  commissionedDate: date.optional(),
  warrantyEnd: date.optional(),
  disposalMethod: z.string().trim().min(1).optional(),
  disposalValue: money.optional(),
});

export const transitionBody = z.object({
  toStatus: z.enum(AssetStatus),
  note: z.string().trim().max(500).optional(),
  stageData: stageDataSchema.default({}),
});

export const timelineQuery = paginationQuery.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type TransitionBody = z.infer<typeof transitionBody>;
