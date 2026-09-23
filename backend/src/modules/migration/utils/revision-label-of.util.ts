// File: backend/src/modules/migration/utils/revision-label-of.util.ts
// Change Log:
// - 2026-09-23: แยกออกจาก revision-label.util.ts (Single Export rule,
//   03-typescript.md) — เดิมไฟล์เดียว export 8 symbols

import { RevisionLabelCarrier } from './revision-label-carrier.type';

/**
 * label ที่ใช้เทียบลำดับของ revision row — ใช้ revisionLabel ถ้ามี
 * fallback เป็น revisionNumber (row เก่าก่อนมี revision_label)
 */
export function revisionLabelOf(rev: RevisionLabelCarrier): string {
  return rev.revisionLabel ?? String(rev.revisionNumber);
}
