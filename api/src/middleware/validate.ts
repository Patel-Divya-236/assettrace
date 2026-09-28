import type { RequestHandler } from "express";
import { z, type ZodError, type ZodType } from "zod";

// Turn zod issues into { fields: { "name": "Required", "fields.0.key": "..." } }
// so the frontend can show each message next to the right input.
export function zodDetails(err: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".") || "_";
    if (!fields[path]) fields[path] = issue.message;
  }
  return { fields };
}

type Schemas = { body?: ZodType; query?: ZodType; params?: ZodType };

// Validates and replaces req.body / req.query / req.params with the parsed
// (typed, defaulted, coerced) values. Invalid input -> 400 VALIDATION_ERROR.
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    if (schemas.query) {
      // Express 5 makes req.query a read-only getter, so redefine it.
      Object.defineProperty(req, "query", {
        value: schemas.query.parse(req.query),
        writable: true,
        configurable: true,
      });
    }
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    next();
  };
}

// Shared schemas
export const idParams = z.object({ id: z.uuid({ message: "Invalid id" }) });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
