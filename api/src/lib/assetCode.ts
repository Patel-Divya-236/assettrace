import type { Db } from "./audit";

export const formatAssetCode = (prefix: string, seq: number) =>
  `${prefix}-${String(seq).padStart(6, "0")}`;

/**
 * Reserves `count` consecutive asset codes for a type, e.g. WP-000041..WP-000045.
 *
 * Must run inside a transaction. Why this is safe with simultaneous requests:
 * `UPDATE ... SET nextSeq = nextSeq + count` is one atomic statement that locks
 * the AssetType row. A second request doing the same update waits for that lock
 * until the first transaction commits, then reads the already-increased value.
 * So two requests can never receive the same number, and if a transaction rolls
 * back, its increment rolls back too.
 */
export async function reserveAssetCodes(tx: Db, typeId: string, count = 1): Promise<string[]> {
  const type = await tx.assetType.update({
    where: { id: typeId },
    data: { nextSeq: { increment: count } },
    select: { codePrefix: true, nextSeq: true },
  });
  const first = type.nextSeq - count;
  return Array.from({ length: count }, (_, i) => formatAssetCode(type.codePrefix, first + i));
}
