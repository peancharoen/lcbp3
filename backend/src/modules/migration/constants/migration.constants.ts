// File: backend/src/modules/migration/constants/migration.constants.ts
// Change Log:
// - 2026-08-17: Initial creation — Centralize magic strings & constants สำหรับ migration module
//   ป้องกันการกระจายของ string literals ที่ทำให้ refactor ยาก (Issue #3, Phase 2.4)

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
 */
export const IMPORT_TX_STATUS_PENDING = 'PENDING' as const;
export const IMPORT_TX_STATUS_PROCESSING = 'PROCESSING' as const;
export const IMPORT_TX_STATUS_SUCCESS = 201 as const;

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
 */
export const ENV_LEGACY_NAS_PATH = 'LEGACY_NAS_PATH' as const;
export const LEGACY_NAS_PATH_DEFAULT = '/mnt/asustor-legacy' as const;

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
