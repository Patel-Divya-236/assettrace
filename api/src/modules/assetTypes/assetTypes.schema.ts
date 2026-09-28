import { z } from "zod";
import { paginationQuery } from "../../middleware/validate";

export const fieldDef = z
  .object({
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, "Key must be snake_case, e.g. lamp_type"),
    label: z.string().trim().min(1, "Label is required"),
    type: z.enum(["text", "number", "date", "select"]),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((f) => f.type !== "select" || (f.options && f.options.length > 0), {
    message: "A select field needs at least one option",
    path: ["options"],
  })
  // Options only make sense for select fields.
  .transform((f) => (f.type === "select" ? f : { ...f, options: undefined }));

export const fieldsArray = z.array(fieldDef).superRefine((fields, ctx) => {
  const seen = new Set<string>();
  fields.forEach((f, i) => {
    if (seen.has(f.key)) {
      ctx.addIssue({ code: "custom", message: `Duplicate key "${f.key}"`, path: [i, "key"] });
    }
    seen.add(f.key);
  });
});

export const createAssetTypeBody = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  codePrefix: z.string().regex(/^[A-Z]{2,4}$/, "Code prefix must be 2-4 capital letters, e.g. WP"),
  icon: z.string().trim().max(40).optional(),
  fields: fieldsArray.default([]),
  expectedLifeYears: z.number().int().positive().optional(),
  maintenanceIntervalDays: z.number().int().positive().optional(),
});

// The code prefix is fixed once created: existing asset codes use it.
export const updateAssetTypeBody = createAssetTypeBody.omit({ codePrefix: true }).partial();

export const listAssetTypesQuery = paginationQuery;

export type CreateAssetTypeBody = z.infer<typeof createAssetTypeBody>;
export type UpdateAssetTypeBody = z.infer<typeof updateAssetTypeBody>;
