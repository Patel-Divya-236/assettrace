import type { AssetStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  checkOpenTickets,
  getAllowedTransitions,
  missingStageFields,
} from "./lifecycle.rules";

const validMoves = Object.entries(ALLOWED_TRANSITIONS).flatMap(([from, tos]) =>
  tos.map((to) => [from as AssetStatus, to] as const),
);

describe("canTransition", () => {
  it.each(validMoves)("admin can move %s -> %s", (from, to) => {
    expect(canTransition(from, to, "ADMIN").ok).toBe(true);
  });

  it.each([
    ["PLANNED", "DISPOSED"],
    ["PLANNED", "IN_OPERATION"],
    ["IN_OPERATION", "PLANNED"],
    ["DECOMMISSIONED", "IN_OPERATION"],
    ["DISPOSED", "PLANNED"],
  ] as const)("rejects invalid move %s -> %s", (from, to) => {
    const result = canTransition(from, to, "ADMIN");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_TRANSITION");
  });

  it("explains the next allowed step in plain words", () => {
    const result = canTransition("PLANNED", "DISPOSED", "ADMIN");
    expect(!result.ok && result.message).toBe(
      "An asset that is Planned can't be Disposed. Next allowed step: Acquired.",
    );
  });

  it("lets a field officer move between in operation and under maintenance", () => {
    expect(canTransition("IN_OPERATION", "UNDER_MAINTENANCE", "FIELD_OFFICER").ok).toBe(true);
    expect(canTransition("UNDER_MAINTENANCE", "IN_OPERATION", "FIELD_OFFICER").ok).toBe(true);
  });

  it("does not let a field officer decommission", () => {
    const result = canTransition("IN_OPERATION", "DECOMMISSIONED", "FIELD_OFFICER");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN_TRANSITION");
  });

  it("does not let a viewer change anything", () => {
    expect(canTransition("IN_OPERATION", "UNDER_MAINTENANCE", "VIEWER").ok).toBe(false);
  });
});

describe("getAllowedTransitions", () => {
  it("DISPOSED has no next moves", () => {
    expect(getAllowedTransitions("DISPOSED", "ADMIN")).toEqual([]);
  });

  it("field officer sees only the repair move", () => {
    expect(getAllowedTransitions("IN_OPERATION", "FIELD_OFFICER")).toEqual(["UNDER_MAINTENANCE"]);
  });

  it("hides repair-done and decommission while tickets are open", () => {
    expect(getAllowedTransitions("UNDER_MAINTENANCE", "ADMIN", 1)).toEqual([]);
    expect(getAllowedTransitions("UNDER_MAINTENANCE", "ADMIN", 0)).toEqual(["IN_OPERATION", "DECOMMISSIONED"]);
  });
});

describe("guards and stage data", () => {
  it("blocks decommissioning with open tickets", () => {
    expect(checkOpenTickets("IN_OPERATION", "DECOMMISSIONED", 2).ok).toBe(false);
    expect(checkOpenTickets("IN_OPERATION", "UNDER_MAINTENANCE", 2).ok).toBe(true);
  });

  it("lists missing required stage fields", () => {
    expect(missingStageFields("ACQUIRED", { cost: 1000 })).toEqual(["acquiredDate", "vendor"]);
    expect(missingStageFields("COMMISSIONED", { commissionedDate: "2024-01-01" })).toEqual([]);
    expect(missingStageFields("DISPOSED")).toEqual(["disposalMethod"]);
    expect(missingStageFields("IN_OPERATION")).toEqual([]);
  });
});
