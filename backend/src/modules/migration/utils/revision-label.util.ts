// File: backend/src/modules/migration/utils/revision-label.util.ts
// Change Log:
// - 2026-09-23: Initial creation — canonical revision label normalization
//   สำหรับ Excel migration (correspondence_number + revision column แยกกัน)
//   รองรับ numeric ('0','1','2') และ alphabetic ('A','B','C') — A=0, B=1, C=2
//   ใช้ร่วมกันระหว่าง ingestion, business rules และ commit paths

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

/**
 * เปรียบเทียบลำดับ revision สองตัว — คืนค่าลบ/ศูนย์/บวก เหมือน comparator ทั่วไป
 * numeric < alpha เมื่อ rank เท่ากัน (0 มาก่อน A) — arbitrary แต่ deterministic
 * ใช้เลือก current revision เมื่อ chain ผสม scheme (edge case)
 */
export function compareRevisionLabels(a: string, b: string): number {
  const na = normalizeRevisionLabel(a);
  const nb = normalizeRevisionLabel(b);
  if (na.rank !== nb.rank) return na.rank - nb.rank;
  if (na.kind !== nb.kind) return na.kind === 'numeric' ? -1 : 1;
  return na.label.localeCompare(nb.label);
}

/** shape ขั้นต่ำของ revision row ที่ util ใช้เทียบ label */
export interface RevisionLabelCarrier {
  revisionLabel?: string | null;
  revisionNumber: number;
}

/**
 * label ที่ใช้เทียบลำดับของ revision row — ใช้ revisionLabel ถ้ามี
 * fallback เป็น revisionNumber (row เก่าก่อนมี revision_label)
 */
export function revisionLabelOf(rev: RevisionLabelCarrier): string {
  return rev.revisionLabel ?? String(rev.revisionNumber);
}

/**
 * หา revision ที่ normalized label ตรงกับ targetLabel — คืน undefined ถ้าไม่มี
 * ใช้ใน commit paths เพื่อ upsert revision เดิมแทนสร้างใหม่ (FR-007)
 */
export function findRevisionByLabel<T extends RevisionLabelCarrier>(
  revisions: readonly T[],
  targetLabel: string
): T | undefined {
  const target = normalizeRevisionLabel(targetLabel).label;
  return revisions.find(
    (rev) => normalizeRevisionLabel(revisionLabelOf(rev)).label === target
  );
}

/**
 * เลือก revision ลำดับสูงสุด (current) โดยเทียบ normalized label —
 * deterministic และ order-independent (import 'B' ก่อน 'A' ก็ได้ 'B' เป็น current)
 */
export function pickCurrentRevision<T extends RevisionLabelCarrier>(
  revisions: readonly T[]
): T {
  let best = revisions[0];
  for (const rev of revisions) {
    if (
      compareRevisionLabels(revisionLabelOf(rev), revisionLabelOf(best)) > 0
    ) {
      best = rev;
    }
  }
  return best;
}

/**
 * หาเลข revision_number ว่างถัดไปเริ่มจาก preferred —
 * กัน rank ชนกันเมื่อ scheme ผสม ('0' กับ 'A' ทั้งคู่ rank 0)
 * ลำดับจริงเทียบจาก label เสมอ revision_number เป็นแค่ storage slot
 */
export function nextFreeRevisionNumber(
  taken: Iterable<number>,
  preferred: number
): number {
  const set = new Set(taken);
  let n = Math.max(0, preferred);
  while (set.has(n)) n += 1;
  return n;
}
