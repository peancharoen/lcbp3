// File: backend/src/modules/migration/types/review-threshold.type.ts
// Change Log:
// - 2026-08-06: Initial creation — read model over system_settings threshold rows (Feature 242, R2, FR-010)

/**
 * ค่า threshold สำหรับจัดกลุ่มรายการใน review queue (FR-010)
 * อ่านจาก system_settings: MIGRATION_MAX_MISMATCH_FIELDS, MIGRATION_MIN_CONFIDENCE
 */
export interface ReviewThresholdSetting {
  /** จำนวนช่องที่ไม่ตรงกันสูงสุดที่ยอมให้ยืนยันได้โดยไม่ต้องตรวจสอบด้วยมือ */
  maxMismatchFields: number;
  /** ค่าความมั่นใจขั้นต่ำ — ถ้าต่ำกว่านี้ต้องตรวจสอบด้วยมือ */
  minConfidence: number;
  /** เวลาที่อัปเดตล่าสุด */
  updatedAt?: Date;
}

/** ค่าเริ่มต้นของ threshold — รักษาพฤติกรรมการผลิตปัจจุบัน (R2) */
export const DEFAULT_REVIEW_THRESHOLDS: Readonly<ReviewThresholdSetting> = {
  maxMismatchFields: 3,
  minConfidence: 0.6,
} as const;

/** ขอบเขตการตรวจสอบค่า threshold (FR-010b) */
export const THRESHOLD_VALIDATION = {
  maxMismatchFields: { min: 0, max: 9 },
  minConfidence: { min: 0, max: 1 },
} as const;

/** Redis cache key สำหรับ threshold (TTL 60s, DEL on update) */
export const THRESHOLD_CACHE_KEY = 'migration:thresholds';
export const THRESHOLD_CACHE_TTL_SECONDS = 60;
