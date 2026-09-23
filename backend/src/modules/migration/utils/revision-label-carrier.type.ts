// File: backend/src/modules/migration/utils/revision-label-carrier.type.ts
// Change Log:
// - 2026-09-23: แยกออกจาก revision-label.util.ts (Single Export rule,
//   03-typescript.md) — เดิมไฟล์เดียว export 8 symbols

/** shape ขั้นต่ำของ revision row ที่ util ใช้เทียบ label */
export interface RevisionLabelCarrier {
  revisionLabel?: string | null;
  revisionNumber: number;
}
