// File: backend/src/modules/migration/types/ai-extraction-details.type.ts
// Change Log:
// - 2026-08-31: Initial creation — MigrationAiExtractionDetails contract types per ADR-050
//   (data-model.md §1-4). Backend-only representation of the AI metadata extraction output
//   contract (`ocrQuality` + per-field `metadata.confidence` + `fieldResolutions`).
// - 2026-09-14: ADR-054 T003 — แคบลงเหลือ AI output + residual ingestion keys เท่านั้น:
//   ตัด `fieldResolutions` ออกจาก details (ย้ายไป `review_state_json` ผ่าน `MigrationReviewState`),
//   `source_file_path` ย้ายไป `storage_temp_path` column, `attachment_ids` ซ้ำ `temp_attachment_ids`
//   column; เพิ่ม `MigrationReviewState` (fieldResolutions + fieldAcknowledgments) สำหรับ
//   review_state_json ใหม่

import type {
  AcknowledgeableField,
  FieldResolutionDto,
} from '../dto/commit-migration-review.dto';

/**
 * ADR-050 §9 / data-model.md §2 — คุณภาพการอ่าน OCR text (แยกจาก business confidence เด็ดขาด)
 */
export interface OcrQualityIssue {
  /** free-form category label จาก LLM เช่น GARBLED_TEXT */
  type: string;
  /** คำอธิบายปัญหาแบบมนุษย์อ่านได้ */
  message: string;
  /** excerpt จาก OCR text ที่เป็นหลักฐาน */
  evidence: string;
}

export interface OcrQualityAssessment {
  /** 0-1 — ประเมินจาก "อ่านได้/ต่อเนื่องของข้อความ" เท่านั้น ไม่ใช่ความถูกต้องเทียบต้นฉบับ */
  confidence: number;
  issues: OcrQualityIssue[];
}

/**
 * ADR-050 §4 / data-model.md §3 — tag ที่ AI เสนอ พร้อม evidence สำหรับ human review
 */
export interface TagSuggestion {
  /** ชื่อ tag ตามที่ AI เสนอ */
  name: string;
  /** true เมื่อไม่พบ tag ชื่อนี้ (case-insensitive) ใน master tags ตอน extraction */
  isNew: boolean;
  /** excerpt จาก OCR text ที่สนับสนุนการเสนอ tag นี้ */
  evidence: string;
  /**
   * Review-time addition (data-model.md §3) — ไม่ใช่ส่วนหนึ่งของ extraction output ดิบ
   * เพิ่มเข้ามาตอนประมวลผล CommitMigrationReviewDto.tagDecisions[]
   */
  accepted?: boolean;
}

/** ADR-050 §4/§9 — per-field confidence ของ metadata แต่ละ field (แยกจาก ocrQuality.confidence) */
export interface MetadataConfidence {
  summary: number;
  correspondenceType: number;
  tags: number;
}

export interface MigrationAiExtractionMetadata {
  summary: string;
  /** MUST เป็นค่าใน correspondence_types.typeCode (FR-005) */
  correspondenceType: string;
  tags: TagSuggestion[];
  confidence: MetadataConfidence;
}

/**
 * ADR-050 Decision 7 — เหตุผลที่ aiFailed=true แยกระหว่าง LLM เรียกไม่สำเร็จ กับ
 * LLM ตอบกลับมาแต่ output ไม่ผ่าน schema validation
 */
export type AiFailureReason = 'SCHEMA_VALIDATION_FAILED' | 'LLM_CALL_FAILED';

/**
 * data-model.md §4 — บันทึกว่า reviewer แก้ไข/รับทราบ field ที่ confidence ต่ำกว่า threshold
 * แล้วหรือยัง (ต่อ field ไม่ใช่ต่อ item — Decision 8) ใช้เป็น commit gate โดย FOUND-COMMIT unit
 *
 * ADR-054: เดิมฝังอยู่ใน `details.fieldResolutions` — หลัง D9 review state ย้ายไป
 * `review_state_json` (ดู `MigrationReviewState`) คง type นี้ไว้เป็น reference shape ของ
 * per-field resolution state ตาม Feature 242 contract (shape ไม่เปลี่ยน เปลี่ยนเฉพาะที่เก็บ)
 */
export interface FieldResolutionState {
  ocrQuality?: 'edited' | 'acknowledged';
  summary?: 'edited' | 'acknowledged';
  correspondenceType?: 'edited' | 'acknowledged';
  tags?: 'edited' | 'acknowledged';
}

/**
 * ADR-054 D9 — shape ของ `migration_review_queue.review_state_json` (`reviewState`)
 * เก็บเฉพาะการตัดสินใจของมนุษย์ (review state) — AI pipeline ห้ามเขียน column นี้เด็ดขาด
 * (FR-003); re-extract ต้องไม่แตะต้อง (data-model.md ownership matrix)
 */
export interface MigrationReviewState {
  /** การตัดสินใจรายช่องของผู้ตรวจสอบ — accept/reject/source ต่อ field (Feature 242, FR-011/FR-011b) */
  fieldResolutions?: FieldResolutionDto[];
  /** field ที่ผู้ตรวจสอบรับทราบ confidence ต่ำโดยไม่แก้ไขค่า (ADR-050 §4) */
  fieldAcknowledgments?: AcknowledgeableField[];
  /** audit trail การเปลี่ยนไฟล์ต้นฉบับโดยผู้ตรวจสอบ (replaceQueueItemFile) */
  fileReplacements?: MigrationFileReplacement[];
}

/**
 * Audit record ของการเปลี่ยนไฟล์ต้นฉบับบน queue item — บันทึกใน review_state_json
 * เพราะเป็นการกระทำของมนุษย์ (AI pipeline ห้ามเขียน column นี้) และ re-extract ต้องไม่ลบ
 */
export interface MigrationFileReplacement {
  /** Idempotency-Key ของ request — ใช้เป็น replay guard */
  idempotencyKey: string;
  /** เวลาที่เปลี่ยนไฟล์ (ISO 8601) */
  at: string;
  /** user id ของผู้เปลี่ยนไฟล์ */
  userId: number;
  /** แหล่งไฟล์ใหม่: STAGING = เลือกจาก Legacy NAS staging, UPLOAD = อัปโหลดจากเครื่องผู้ตรวจ */
  source: 'STAGING' | 'UPLOAD';
  /** storageTempPath เดิมก่อนเปลี่ยน (null ถ้าไม่เคยมี) */
  previousPath: string | null;
  /** path ใหม่ที่ผูกเข้ากับ queue item */
  newPath: string;
  /** ชื่อไฟล์ใหม่ */
  filename: string;
  /** publicId (UUIDv7) ของ attachment row ที่ผูกกับ queue item */
  attachmentPublicId: string;
}

/**
 * data-model.md §1 + ADR-054 — shape ของ `migration_review_queue.ai_metadata_json` (`details`)
 * หลัง extraction ตาม ADR-050 (new-format marker คือ `metadata.confidence` ที่มีครบ 3 field)
 *
 * ADR-054: bag นี้แคบลงเหลือ **AI extraction output + residual ingestion keys** เท่านั้น
 * - `fieldResolutions` ย้ายไป `review_state_json` (ดู `MigrationReviewState`)
 * - `source_file_path` ย้ายไป `storage_temp_path` column (D1)
 * - `attachment_ids` ซ้ำ `temp_attachment_ids` column — ไม่เขียนอีก
 */
export interface MigrationAiExtractionDetails extends Record<string, unknown> {
  ocrQuality: OcrQualityAssessment;
  metadata: MigrationAiExtractionMetadata;
  aiFailureReason?: AiFailureReason;
  // ── Residual ingestion keys (ADR-054 D3 preservedFields — ไม่มี dedicated column) ──
  /** index ของแถวใน Excel ตอน ingestion (เก็บไว้ debug/audit) */
  original_row_index?: number;
  /** ชื่อองค์กรผู้ส่ง/ผู้รับจาก Excel ที่ resolve ไม่ได้ตอน ingestion */
  unresolved_orgs?: Record<string, string>;
  /** เลขที่เอกสารดั้งเดิมก่อนถูกเติม revision suffix (-R1, -R2, …) */
  original_document_number?: string;
  /** ลำดับ revision ภายใน batch เดียวกัน (0 = ต้นฉบับ) */
  revision_number?: number;
}
