// File: backend/src/modules/migration/utils/find-revision-by-label.util.ts
// Change Log:
// - 2026-09-23: แยกออกจาก revision-label.util.ts (Single Export rule,
//   03-typescript.md) — เดิมไฟล์เดียว export 8 symbols

import { normalizeRevisionLabel } from './normalize-revision-label.util';
import { revisionLabelOf } from './revision-label-of.util';
import { RevisionLabelCarrier } from './revision-label-carrier.type';

/**
 * หา revision ที่ normalized label ตรงกับ targetLabel — คืน undefined ถ้าไม่มี
 * ใช้ใน commit paths เพื่อ upsert revision เดิมแทนสร้างใหม่ (FR-007)
 */
export function findRevisionByLabel<T extends RevisionLabelCarrier>(
  revisions: readonly T[],
  targetLabel: string
): T | undefined {
  const target = normalizeRevisionLabel(targetLabel).label;
  return revisions.find(
    (rev) => normalizeRevisionLabel(revisionLabelOf(rev)).label === target
  );
}
