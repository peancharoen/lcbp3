// File: backend/src/modules/migration/utils/compare-revision-labels.util.ts
// Change Log:
// - 2026-09-23: แยกออกจาก revision-label.util.ts (Single Export rule,
//   03-typescript.md) — เดิมไฟล์เดียว export 8 symbols

import { normalizeRevisionLabel } from './normalize-revision-label.util';

/**
 * เปรียบเทียบลำดับ revision สองตัว — คืนค่าลบ/ศูนย์/บวก เหมือน comparator ทั่วไป
 * numeric < alpha เมื่อ rank เท่ากัน (0 มาก่อน A) — arbitrary แต่ deterministic
 * ใช้เลือก current revision เมื่อ chain ผสม scheme (edge case)
 */
export function compareRevisionLabels(a: string, b: string): number {
  const na = normalizeRevisionLabel(a);
  const nb = normalizeRevisionLabel(b);
  if (na.rank !== nb.rank) return na.rank - nb.rank;
  if (na.kind !== nb.kind) return na.kind === 'numeric' ? -1 : 1;
  return na.label.localeCompare(nb.label);
}
