import { describe, expect, it } from "vitest";
import { haversineMeters } from "../modules/public/public.service";
import { canReport, toPublicStatus } from "./statusMap";

describe("toPublicStatus", () => {
  it("maps the 7 stages to 3 public states", () => {
    expect(toPublicStatus("IN_OPERATION")).toBe("WORKING");
    expect(toPublicStatus("UNDER_MAINTENANCE")).toBe("BEING_REPAIRED");
    for (const s of ["PLANNED", "ACQUIRED", "COMMISSIONED", "DECOMMISSIONED", "DISPOSED"] as const) {
      expect(toPublicStatus(s)).toBe("NOT_IN_SERVICE");
    }
  });

  it("allows reports only on assets in service", () => {
    expect(canReport("IN_OPERATION")).toBe(true);
    expect(canReport("UNDER_MAINTENANCE")).toBe(true);
    expect(canReport("DECOMMISSIONED")).toBe(false);
  });
});

describe("haversineMeters", () => {
  it("is 0 for the same point and about 111 km per degree of latitude", () => {
    expect(haversineMeters(23.2, 72.6, 23.2, 72.6)).toBe(0);
    expect(Math.round(haversineMeters(23, 72.6, 24, 72.6) / 1000)).toBe(111);
  });
});
