// File: backend/src/modules/migration/utils/next-free-revision-number.util.ts
// Change Log:
// - 2026-09-23: แยกออกจาก revision-label.util.ts (Single Export rule,
//   03-typescript.md) — เดิมไฟล์เดียว export 8 symbols

/**
 * หาเลข revision_number ว่างถัดไปเริ่มจาก preferred —
 * กัน rank ชนกันเมื่อ scheme ผสม ('0' กับ 'A' ทั้งคู่ rank 0)
 * ลำดับจริงเทียบจาก label เสมอ revision_number เป็นแค่ storage slot
 */
export function nextFreeRevisionNumber(
  taken: Iterable<number>,
  preferred: number
): number {
  const set = new Set(taken);
  let n = Math.max(0, preferred);
  while (set.has(n)) n += 1;
  return n;
}
