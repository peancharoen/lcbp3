// File: backend/src/modules/ai/types/migration-compare-result.type.ts
// Change Log:
// - 2026-08-06: Initial creation — typed compare payload + parser guard (Feature 242, R1, R7)

/**
 * ชื่อช่องที่เปรียบเทียบระหว่างทะเบียนกับเอกสารจริง (FR-006)
 */
export type ComparedField =
  | 'documentNumber'
  | 'subject'
  | 'documentDate'
  | 'fromOrganization'
  | 'toOrganization'
  | 'correspondenceType'
  | 'discipline'
  | 'project'
  | 'revision';

/**
 * รายการชื่อช่องที่เปรียบเทียบทั้งหมด 9 ช่อง (FR-006)
 */
export const COMPARED_FIELDS: readonly ComparedField[] = [
  'documentNumber',
  'subject',
  'documentDate',
  'fromOrganization',
  'toOrganization',
  'correspondenceType',
  'discipline',
  'project',
  'revision',
] as const;

/**
 * ผลการเปรียบเทียบรายช่อง (FR-007)
 */
export interface CompareFieldResult {
  /** ชื่อช่องที่เปรียบเทียบ */
  field: ComparedField;
  /** ค่าจากทะเบียนเอกสาร (Excel register) */
  excelValue: string | null;
  /** ค่าที่พบในเอกสารจริงจาก OCR */
  ocrValue: string | null;
  /** ผลการเปรียบเทียบ — true เมื่อตรงกัน */
  match: boolean;
  /** ระบุว่าพบค่านี้ในเอกสารจริงหรือไม่ — ใช้ควบคุมตัวเลือก "ใช้ค่าจากเอกสาร" ใน UI (FR-011c) */
  foundInDocument: boolean;
}

/**
 * ผลการเปรียบเทียบทะเบียนกับเอกสารจริงทั้งฉบับ (FR-007, FR-008)
 * จัดเก็บใน migration_review_queue.ai_metadata_json และ ai_audit_logs.ai_suggestion_json
 */
export interface CompareResult {
  /** ผลการเปรียบเทียบรายช่อง */
  fieldResults: CompareFieldResult[];
  /** ชื่อช่องที่ match = false */
  mismatches: string[];
  /** ค่าความมั่นใจโดยรวม 0.0-1.0 (FR-008) */
  confidence: number;
}

/**
 * การตัดสินใจของผู้ตรวจสอบรายช่อง (FR-011, FR-011b)
 * ส่งใน commit payload และจัดเก็บใน ai_audit_logs.human_override_json (R7)
 */
export interface FieldResolution {
  /** ชื่อช่อง */
  field: string;
  /** แหล่งที่มาของค่าที่เลือก — EXCEL (ทะเบียน), DOCUMENT (เอกสารจริง), MANUAL (พิมพ์เอง) */
  source: 'EXCEL' | 'DOCUMENT' | 'MANUAL';
  /** ค่าที่ใช้จริง */
  finalValue: string;
}

/**
 * ค่า threshold ที่จับภาพไว้ ณ เวลาประมวลผล (FR-010c)
 * จัดเก็บใน ai_metadata_json เพื่อให้ reviewGroup คำนวณซ้ำได้เหมือนเดิม
 */
export interface CapturedThresholds {
  maxMismatchFields: number;
  minConfidence: number;
}

const isComparedField = (value: unknown): value is ComparedField => {
  return (
    typeof value === 'string' &&
    (COMPARED_FIELDS as readonly string[]).includes(value)
  );
};

const readNullableString = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null;
};

const readBoolean = (value: unknown): boolean => {
  return value === true;
};

const readNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
};

/**
 * แปลงผลลัพธ์ LLM ดิบเป็น CompareResult ที่ผ่านการตรวจสอบประเภทแล้ว
 * ทำ 5 ขั้นตอน normalisation ตาม contract §7:
 *   1. ตัด ```json fence
 *   2. กรองเฉพาะ field ที่อยู่ใน enum
 *   3. บังคับ match = false เมื่อ foundInDocument = false
 *   4. คำนวณ mismatches ใหม่จาก fieldResults (ไม่เชื่อใจ list ของ model)
 *   5. clamp confidence ให้อยู่ใน [0,1]; default 0.5 เมื่อขาดหรือไม่ใช่ตัวเลข
 * @returns CompareResult ที่ผ่านการ normalize แล้ว หรือ null เมื่อ parse ไม่ได้
 */
export const parseCompareResult = (
  rawResponse: string
): CompareResult | null => {
  // 1. ตัด ```json / ``` fence
  const cleaned = rawResponse
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const source = parsed as Record<string, unknown>;

  // 2. กรองเฉพาะ fieldResults ที่ field อยู่ใน enum
  const rawFieldResults = Array.isArray(source.fieldResults)
    ? source.fieldResults
    : [];
  const fieldResults: CompareFieldResult[] = [];
  for (const item of rawFieldResults) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const field = obj.field;
    if (!isComparedField(field)) continue;
    const foundInDocument = readBoolean(obj.foundInDocument);
    // 3. บังคับ match = false เมื่อ foundInDocument = false
    const match = foundInDocument ? readBoolean(obj.match) : false;
    fieldResults.push({
      field,
      excelValue: readNullableString(obj.excelValue),
      ocrValue: foundInDocument ? readNullableString(obj.ocrValue) : null,
      match,
      foundInDocument,
    });
  }
  if (fieldResults.length === 0) {
    return null;
  }

  // 4. คำนวณ mismatches ใหม่จาก fieldResults
  const mismatches = fieldResults
    .filter((result) => !result.match)
    .map((result) => result.field);

  // 5. clamp confidence; default 0.5
  const rawConfidence = readNumber(source.confidence);
  const confidence =
    rawConfidence === undefined ? 0.5 : Math.min(1, Math.max(0, rawConfidence));

  return { fieldResults, mismatches, confidence };
};
