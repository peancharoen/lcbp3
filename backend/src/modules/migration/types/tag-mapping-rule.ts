// File: backend/src/modules/migration/types/tag-mapping-rule.ts
// Change Log:
// - 2026-08-06: Initial creation — deterministic register-field → tag mapping (Feature 242, FR-018, FR-018a, FR-018b)

/**
 * กฎการแมป register field → tag prefix (FR-018, FR-018b)
 * เป็น static constant ที่ versioned — ไม่ได้มาจาก LLM (FR-018a)
 * input เดียวกันยัดได้ tag name เดียวกันเสมอ ทำให้ re-run ไม่มี duplicate (SC-010)
 */
export interface TagMappingRule {
  /** ชื่อ register field ใน Excel metadata */
  registerField: 'discipline' | 'correspondenceType';
  /** prefix ของ tag name เช่น "discipline:" หรือ "type:" */
  tagPrefix: string;
}

/**
 * รายการกฎการแมป register field → tag name (FR-018, FR-018b)
 * tag name = tagPrefix + registerValue (เช่น "discipline:STRUCT", "type:RFA")
 */
export const TAG_MAPPING_RULES: readonly TagMappingRule[] = [
  { registerField: 'discipline', tagPrefix: 'discipline:' },
  { registerField: 'correspondenceType', tagPrefix: 'type:' },
] as const;

/**
 * สร้าง tag name จาก register field และค่า (FR-018b)
 * @param registerField ชื่อ register field
 * @param value ค่าจากทะเบียน
 * @returns tag name ที่ derive แล้ว หรือ null ถ้า registerField ไม่มีในกฎ
 */
export const deriveTagName = (
  registerField: string,
  value: string
): string | null => {
  const rule = TAG_MAPPING_RULES.find((r) => r.registerField === registerField);
  if (!rule) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return `${rule.tagPrefix}${trimmed}`;
};
