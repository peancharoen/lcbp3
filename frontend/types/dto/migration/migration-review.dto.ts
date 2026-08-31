// File: types/dto/migration/migration-review.dto.ts
// Change Log:
// - 2026-08-31: ADR-050 — tags: string[] → tagDecisions[] (breaking), เพิ่ม fieldAcknowledgments
//   (data-model.md §6; backend iterates tagDecisions[] ทุกตัวตรงๆ ไม่ diff กับ AI suggestions —
//   ต้องส่งทั้ง accepted และ rejected entries)
// - 2026-05-22: Initial creation for US2 - Staging Migration Review Commit Types
// - 2026-05-22: Update to support hybrid ID (number | string) for projects and organizations per ADR-019

/** ADR-050 (data-model.md §6): การตัดสินใจของผู้ตรวจสอบต่อ tag suggestion แต่ละตัว */
export interface TagDecision {
  name: string;
  accepted: boolean;
  evidence?: string;
}

/** ADR-050: field ที่รองรับการ acknowledge เมื่อ confidence ต่ำกว่า threshold (FR-013/FR-014) */
export type AcknowledgeableMigrationField = 'ocrQuality' | 'summary' | 'category' | 'tags';

export interface CommitMigrationReviewDto {
  publicId: string;
  subject?: string;
  category?: string;
  projectId?: number | string;
  senderId?: number | string;
  receiverId?: number | string;
  issuedDate?: string;
  receivedDate?: string;
  /** @deprecated ADR-050 breaking change — ใช้ tagDecisions แทน */
  tags?: string[];
  body?: string;
  /** ADR-050 (FR-006/FR-007/FR-008): แทนที่ tags — ต้องส่งทั้ง accepted และ rejected entries
   *  ที่ผู้ตรวจสอบตัดสินใจแล้ว (backend ไม่ diff กับ AI suggestions ใดๆ) */
  tagDecisions?: TagDecision[];
  /** ADR-050 (FR-013/FR-014): field ที่ผู้ตรวจสอบรับทราบ confidence ต่ำโดยไม่แก้ไขค่า */
  fieldAcknowledgments?: AcknowledgeableMigrationField[];
}
