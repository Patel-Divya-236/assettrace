import type { AssetStatus } from "@prisma/client";

// The public sees 3 simple states; staff see all 7 stages (D-10).
export type PublicStatus = "WORKING" | "BEING_REPAIRED" | "NOT_IN_SERVICE";

export function toPublicStatus(status: AssetStatus): PublicStatus {
  if (status === "IN_OPERATION") return "WORKING";
  if (status === "UNDER_MAINTENANCE") return "BEING_REPAIRED";
  return "NOT_IN_SERVICE";
}

// Citizens can only report problems on assets that are in service (D-21).
export const canReport = (status: AssetStatus) => status === "IN_OPERATION" || status === "UNDER_MAINTENANCE";
