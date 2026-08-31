// File: backend/src/modules/migration/types/ai-extraction-details.type.ts
// Change Log:
// - 2026-08-31: Initial creation — MigrationAiExtractionDetails contract types per ADR-050
//   (data-model.md §1-4). Backend-only representation of the AI metadata extraction output
//   contract (`ocrQuality` + per-field `metadata.confidence` + `fieldResolutions`).

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
  category: number;
  tags: number;
}

export interface MigrationAiExtractionMetadata {
  summary: string;
  /** MUST เป็นค่าใน correspondence_types.typeCode (FR-005) */
  category: string;
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
 */
export interface FieldResolutionState {
  ocrQuality?: 'edited' | 'acknowledged';
  summary?: 'edited' | 'acknowledged';
  category?: 'edited' | 'acknowledged';
  tags?: 'edited' | 'acknowledged';
}

/**
 * data-model.md §1 — shape ของ `migration_review_queue.ai_metadata_json` (`details`)
 * หลัง extraction ตาม ADR-050 (new-format marker คือ `metadata.confidence` ที่มีครบ 3 field)
 */
export interface MigrationAiExtractionDetails extends Record<string, unknown> {
  ocrQuality: OcrQualityAssessment;
  metadata: MigrationAiExtractionMetadata;
  aiFailureReason?: AiFailureReason;
  /** เพิ่มโดย review actions เท่านั้น ไม่ใช่โดย extraction (data-model.md §1) */
  fieldResolutions?: FieldResolutionState;
}
