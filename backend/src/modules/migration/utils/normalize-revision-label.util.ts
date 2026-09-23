// File: backend/src/modules/migration/utils/normalize-revision-label.util.ts
// Change Log:
// - 2026-09-23: แยกออกจาก revision-label.util.ts (Single Export rule,
//   03-typescript.md) — เดิมไฟล์เดียว export 8 symbols

/**
 * ผลการ normalize revision label จาก Excel
 * - label: ค่าที่แสดงผล (normalize แล้ว — trim + uppercase สำหรับ alpha)
 * - rank: ลำดับเปรียบเทียบสำหรับหา current revision (ตัวเลขเทียบตรง ๆ,
 *   ตัวอักษร A=0, B=1, C=2 — ตรงกับ datafix 2026-09-23 และ
 *   ALPHABET_REVISION_TYPES ใน correspondence.service)
 * - kind: ชนิดของ label ('numeric' | 'alpha' | 'other')
 * - isMixedSchemeInvalid: true ถ้า label ไม่ตรง pattern ใด ๆ (เช่น 'R1', '1A')
 */
export interface NormalizedRevision {
  label: string;
  rank: number;
  kind: 'numeric' | 'alpha' | 'other';
  isValid: boolean;
}

const NUMERIC_PATTERN = /^\d+$/;
const ALPHA_PATTERN = /^[A-Z]+$/;
const DEFAULT_REVISION_LABEL = '0';

/**
 * Normalize revision label ดิบจาก Excel/queue details
 * - undefined/null/empty → default '0'
 * - numeric string ('0', '1', '07') → rank = ตัวเลข (leading zero ตัดทิ้งผ่าน Number)
 * - alpha string ('a', 'A', 'b') → uppercase, rank = A=0, B=1, ...
 * - อื่น ๆ ('R1', '1A', 'rev 2') → isValid=false, rank = -1 (caller ตัดสินใจ)
 */
export function normalizeRevisionLabel(
  raw?: string | null
): NormalizedRevision {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return {
      label: DEFAULT_REVISION_LABEL,
      rank: 0,
      kind: 'numeric',
      isValid: true,
    };
  }
  const trimmed = String(raw).trim();
  if (NUMERIC_PATTERN.test(trimmed)) {
    return {
      label: trimmed,
      rank: Number(trimmed),
      kind: 'numeric',
      isValid: true,
    };
  }
  const upper = trimmed.toUpperCase();
  if (ALPHA_PATTERN.test(upper)) {
    // A=0, B=1, ..., Z=25, AA=26 (multi-letter: base-26 positional)
    let rank = 0;
    for (const ch of upper) {
      rank = rank * 26 + (ch.charCodeAt(0) - 65) + 1;
    }
    return { label: upper, rank: rank - 1, kind: 'alpha', isValid: true };
  }
  return { label: trimmed, rank: -1, kind: 'other', isValid: false };
}
