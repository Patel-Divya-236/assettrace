import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../lib/AppError";
import { requireRole } from "./requireRole";

const run = (user: Request["user"]) => {
  const next = vi.fn() as unknown as NextFunction;
  const req = { user } as Request;
  try {
    requireRole("ADMIN", "FIELD_OFFICER")(req, {} as Response, next);
    return { next, error: undefined };
  } catch (error) {
    return { next, error: error as AppError };
  }
};

describe("requireRole", () => {
  it("lets an allowed role through", () => {
    const { next, error } = run({ id: "u1", role: "FIELD_OFFICER" });
    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("rejects a role that is not allowed with 403", () => {
    const { error } = run({ id: "u1", role: "VIEWER" });
    expect(error?.httpStatus).toBe(403);
    expect(error?.code).toBe("FORBIDDEN");
  });

  it("rejects a missing user with 401", () => {
    const { error } = run(undefined);
    expect(error?.httpStatus).toBe(401);
  });
});
