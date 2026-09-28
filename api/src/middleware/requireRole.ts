import type { Role } from "@prisma/client";
import type { RequestHandler } from "express";
import { AppError } from "../lib/AppError";

// Usage: router.post("/", requireRole("ADMIN"), handler)
// Must run after requireAuth. Hiding buttons in the UI is not security; this is.
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHENTICATED", "Please log in to continue.");
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to do this.", {
        requiredRoles: roles,
      });
    }
    next();
  };
}

// Every staff route: citizens have accounts too, but must never reach staff data.
export const STAFF_ROLES: Role[] = ["ADMIN", "OFFICER", "FIELD_OFFICER", "VIEWER"];
export const requireStaff = requireRole(...STAFF_ROLES);
