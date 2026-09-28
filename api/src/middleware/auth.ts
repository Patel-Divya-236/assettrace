import type { Role } from "@prisma/client";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../lib/AppError";

export type AuthUser = { id: string; role: Role };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

type TokenPayload = { sub: string; role: Role };

// Stateless: the token itself proves who the user is. No database lookup,
// no server session, so any API instance can handle any request.
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHENTICATED", "Please log in to continue.");
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as TokenPayload;
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw new AppError(401, "SESSION_EXPIRED", "Your session has expired. Please log in again.");
  }
};

// For handlers behind requireAuth: returns the user or fails loudly.
export function currentUser(req: Express.Request): AuthUser {
  if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Please log in to continue.");
  return req.user;
}
