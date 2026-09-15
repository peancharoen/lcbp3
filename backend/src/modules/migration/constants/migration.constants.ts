// File: backend/src/modules/migration/constants/migration.constants.ts
// Change Log:
// - 2026-08-17: Initial creation — Centralize magic strings & constants สำหรับ migration module
//   ป้องกันการกระจายของ string literals ที่ทำให้ refactor ยาก (Issue #3, Phase 2.4)
// - 2026-09-14: ADR-054 T004 — single-source OCR failure placeholder (NO_PDF_OCR_PLACEHOLDER
//   + OCR_FAILURE_PLACEHOLDERS + isOcrFailurePlaceholder) สำหรับ snapshot-skip rule ของ
//   ocr_text_bak (R3) — เดิม string นี้ hardcode กระจายใน ai-batch.processor.ts 3 จุด

/**
 * ค่า Master Data ที่ migration module อ้างอิง — ต้องมีใน DB seed data
 * ถ้าไม่พบ จะ throw BusinessException (ไม่ fallback ค่าอัตโนมัติ)
 */
export const RFA_TYPE_CODE_GENERIC = 'GEN' as const;
export const RFA_STATUS_CODE_APPROVED = 'APP' as const;
export const CORRESPONDENCE_STATUS_CLBOWN = 'CLBOWN' as const;
export const CORRESPONDENCE_STATUS_DRAFT = 'DRAFT' as const;

/**
 * Import Transaction batch IDs ที่ใช้ในระบบ
 */
export const BATCH_ID_HUMAN_REVIEW = 'HUMAN_REVIEW' as const;

/**
 * Import Transaction status codes
 * status_code column เป็น int(11) — ใช้ integer ไม่ใช่ string
 * 201 = success (HTTP 201 Created), 500 = failure (HTTP 500)
 * 100 = pending (ยังไม่ได้ประมวลผล), 101 = processing (กำลังประมวลผล)
 */
export const IMPORT_TX_STATUS_PENDING = 100 as const;
export const IMPORT_TX_STATUS_PROCESSING = 101 as const;
export const IMPORT_TX_STATUS_SUCCESS = 201 as const;
export const IMPORT_TX_STATUS_FAILED = 500 as const;

/**
 * Queue status values สำหรับ MigrationReviewQueue (mirror of MigrationReviewStatus enum)
 * ใช้ใน raw SQL queries ที่ไม่สามารถใช้ enum ได้โดยตรง
 */
export const QUEUE_STATUS_PENDING = 'PENDING' as const;

/**
 * Staging directory env var name
 */
export const ENV_STAGING_DIR = 'MIGRATION_STAGING_DIR' as const;
export const STAGING_DIR_DEFAULT = 'uploads/staging' as const;

/**
 * Legacy NAS path env var name — โฟลเดอร์บน NAS ที่เก็บไฟล์ Excel และ PDF ของเอกสาร Legacy
 * ใช้สำหรับ listing ไฟล์ในหน้า Legacy Management
 * Default = mount target ใน backend container (docker-compose: /mnt/asustor-legacy → /mnt/legacy-staging:ro)
 */
export const ENV_LEGACY_NAS_PATH = 'LEGACY_NAS_PATH' as const;
export const LEGACY_NAS_PATH_DEFAULT = '/mnt/legacy-staging' as const;

/**
 * ความยาวสูงสุดของคอลัมน์ ai_job_id ใน migration_review_queue
 * ต้องรองรับ custom BullMQ jobId ที่ยาวกว่า UUID เปล่า เช่น
 * `legacy-enrich-<publicId>` (~50 ตัวอักษร) หรือ
 * `legacy-enrich-<publicId>-<idempotencyKey>` (~110 ตัวอักษร)
 * (Bugfix 2026-08-23 — เดิมกำหนดไว้ที่ 36 ตัวอักษรทำให้ save ล้มเหลวทุกแถว)
 */
export const MIGRATION_AI_JOB_ID_MAX_LENGTH = 150 as const;

/**
 * Default batch timeout (ms) สำหรับ MetadataResolutionService
 */
export const DEFAULT_BATCH_TIMEOUT_MS = 30000 as const;
export const SETTING_KEY_BATCH_TIMEOUT =
  'MIGRATION_RESOLVE_BATCH_TIMEOUT_MS' as const;

/**
 * System setting keys ที่ migration module ใช้
 */
export const SETTING_KEY_REVIEW_THRESHOLDS =
  'MIGRATION_REVIEW_THRESHOLDS' as const;

/**
 * ADR-054 R3/D5 — OCR failure placeholder ที่ extractor เขียนลง `ocr_text` เมื่อไม่มีไฟล์ PDF
 * ต้อง single-source ที่นี่เพื่อให้ snapshot rule (`ocr_text` → `ocr_text_bak`) ข้ามการสำเนา
 * ค่า placeholder ได้ถูกต้อง — bak ต้องเก็บ "ข้อความจริงล่าสุด" เสมอ ไม่ใช่ placeholder
 * (ผู้เขียน placeholder: AiBatchProcessor — processLegacyAiEnrichment + processLegacyOcrBatchPhase)
 */
export const NO_PDF_OCR_PLACEHOLDER = 'ไม่มี ไฟล์ PDF (ยกเลิก/ถอน)' as const;

/**
 * รายการ OCR failure placeholders ทั้งหมดที่ snapshot rule ต้องข้าม (exact-match)
 * วางเป็น list เผื่ออนาคตมี placeholder อื่น (เช่น OCR_FAILED) เพิ่มเข้ามา
 */
export const OCR_FAILURE_PLACEHOLDERS: readonly string[] = [
  NO_PDF_OCR_PLACEHOLDER,
];

/**
 * ตรวจว่าค่า ocr_text ปัจจุบันเป็น known failure placeholder หรือไม่ (exact-match)
 * ใช้โดย snapshot-on-overwrite rule ทุก write path (extraction + manual edit + re-extract reset)
 */
export function isOcrFailurePlaceholder(value?: string | null): boolean {
  return typeof value === 'string' && OCR_FAILURE_PLACEHOLDERS.includes(value);
}
