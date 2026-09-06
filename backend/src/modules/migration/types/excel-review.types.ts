// File: backend/src/modules/migration/types/excel-review.types.ts
// Change Log:
// - 2026-09-05: Initial creation — data contracts สำหรับ 4-Layer Excel Data
//   Review Pipeline (Feature 252, ADR-052, T002) ตาม data-model.md ทุกประการ
//   เป็น foundation ที่ service ทุกตัวใน Wave 2-6 ต้อง import ร่วมกัน
// - 2026-09-06: เพิ่ม BatchStrategy type สำหรับ Q3 Batching Strategy
//   (FULL = synchronous ≤200 rows, FAST_SELECTIVE = WARN + 5% sample >200 rows)

/**
 * ระดับความรุนแรงของ finding จากการตรวจทาน (data-model.md §2)
 * - BLOCK: ผิดกฎจนต้องหยุด (เช่น ลำดับวันที่ขัดแย้ง, โครงการไม่ตรง)
 * - WARN: ควรตรวจสอบก่อนยืนยัน (เช่น หน่วยงานไม่ตรง Master, ระบุไฟล์แต่ไม่ส่งมา)
 * - AI_SUGGEST: คำแนะนำจาก Layer 3 AI Reviewer (Human-in-the-loop เท่านั้น)
 */
export type FindingLevel = 'BLOCK' | 'WARN' | 'AI_SUGGEST';

/**
 * โหมดปลายทางของการนำเข้า (FR-001, D1/D14)
 * - MIGRATION_STAGING: Legacy Migration → Staging Queue + Partial Quarantine
 * - DIRECT_IMPORT: นำเข้าประจำวัน → Atomic All-or-Nothing (FR-015)
 */
export type ReviewTargetMode = 'MIGRATION_STAGING' | 'DIRECT_IMPORT';

/**
 * ผู้ให้บริการ AI Reviewer ของ Layer 3 (FR-008, D2)
 * Multi-tier: LOCAL_OLLAMA (default) → GEMINI (free tier) → CLAUDE (paid tier)
 * คลาวด์ต้องมีสิทธิ์ Admin + ALLOW_EXTERNAL_AI_REVIEW=true และ Fail-Open เสมอ
 */
export type AiReviewerProvider = 'LOCAL_OLLAMA' | 'GEMINI' | 'CLAUDE';

/**
 * กลยุทธ์การส่งแถวให้ AI Reviewer (Q3 Batching Strategy, US3 Acceptance 1)
 * - FULL: ส่งทุกแถวให้ AI แบบ synchronous (default, สำหรับ ≤200 แถว)
 * - FAST_SELECTIVE: ส่งเฉพาะแถวที่ติด WARN + สุ่ม 5% ของแถวที่เหลือ
 *   (สำหรับ >200 แถว เพื่อลดเวลาประมวลผลโดยไม่ติด Rate Limit)
 */
export type BatchStrategy = 'FULL' | 'FAST_SELECTIVE';

/** จำนวนแถวที่เป็นเกณฑ์เปิดใช้ FAST_SELECTIVE (Q3) */
export const FAST_SELECTIVE_THRESHOLD = 200;

/** เปอร์เซ็นต์การสุ่มตัวอย่างแถวที่ผ่าน (ไม่ติด WARN/BLOCK) ในโหมด FAST_SELECTIVE */
export const FAST_SELECTIVE_SAMPLE_PERCENT = 0.05;

/**
 * ข้อมูล Review Session ที่เก็บใน Redis ภายใต้คีย์
 * `import_review:session:<reviewSessionPublicId>` ด้วย TTL 24 ชั่วโมง
 * (FR-012, D8, data-model.md §1) — ไม่สร้างตารางชั่วคราวใน MariaDB (ADR-044)
 *
 * หมายเหตุ ADR-019: identifier ทุกตัวเป็น UUID string (publicId-style)
 * ห้าม parseInt/Number/+ บน UUID และห้าม expose INT id
 */
export interface ReviewSessionData {
  /** UUIDv7 string ของ session (visible ผ่าน API) */
  reviewSessionPublicId: string;
  /** UUIDv7 string ของโครงการ */
  projectPublicId: string;
  targetMode: ReviewTargetMode;
  /** User publicId ของผู้อัปโหลด */
  uploadedBy: string;
  totalRows: number;
  passCount: number;
  warnCount: number;
  blockCount: number;
  aiSuggestCount: number;
  originalFileName: string;
  /** Absolute path ของไฟล์ดิบใน private stash */
  originalFilePath: string;
  /** Absolute path ของไฟล์ .xlsx ฉบับ annotated ที่ระบบสร้างขึ้น */
  annotatedFilePath: string;
  /** Absolute path ของไฟล์ failed_rows.xlsx (MIGRATION_STAGING quarantine — D6)
   *  หมายเหตุ: sessions ที่สร้างก่อน Wave 5 อาจไม่มี field นี้ —
   *  isValidSessionData ถือว่า undefined เป็น valid เพื่อ backward compat */
  failedRowsFilePath: string;
  selectedAiProvider: AiReviewerProvider;
  status: 'READY' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  /** ISO date string ของเวลาที่สร้าง session */
  createdAt: string;
  /** ISO date string ของเวลาหมดอายุ (+24h) */
  expiresAt: string;
}

/**
 * Finding ที่พบระหว่างการตรวจทาน (data-model.md §2)
 * ใช้ส่งผ่านระหว่าง Layer 1, Layer 2, Layer 3 และใช้เรนเดอร์
 * สีไฮไลต์ + Cell Comments ในไฟล์ Annotated Excel (FR-010)
 */
export interface ReviewFinding {
  /** 1-based row index ใน Excel */
  row: number;
  /** Column letter เช่น "B" หรือชื่อคอลัมน์ เช่น "Document Number" */
  column: string;
  level: FindingLevel;
  /** ข้อความอธิบายปัญหาภาษาไทย อ่านง่ายโดยผู้ใช้ */
  message: string;
  originalValue: unknown;
  /** ค่าที่ระบบหรือ AI เสนอ (ถ้ามี) */
  suggestedValue?: unknown;
  /** ค่าความมั่นใจของ AI ช่วง 0.00-1.00 (ถ้ามี) */
  confidence?: number;
}

/**
 * แถวข้อมูลมาตรฐานหลังผ่าน ExcelRowBuilder (data-model.md §3)
 * ใช้ร่วมกันทั้งขั้นตอน Check และ Commit เพื่อป้องกันความคลาดเคลื่อน
 * ของตรรกะ (FR-002) — ระบบเพิกเฉยคอลัมน์ที่ขึ้นต้นด้วย `[AI]`
 * อัตโนมัติเมื่อ Re-upload (FR-011)
 */
export interface ExcelCorrespondenceRow {
  rowIndex: number;
  documentNumber: string;
  subject: string;
  correspondenceTypeCode?: string;
  disciplineCode?: string;
  /** เลข Revision — Default '0' (ExcelRowBuilder ใส่ค่าเริ่มต้นให้, D10) */
  revisionNumber: string;
  issuedDate?: Date;
  receivedDate?: Date;
  /** ชื่อหน่วยงานผู้ส่งดิบจาก Excel (ก่อน resolve) */
  senderOrgRaw?: string;
  /** Resolved จาก DB Map (master organizations) */
  senderOrgId?: number;
  /** ชื่อหน่วยงานผู้รับดิบจาก Excel (ก่อน resolve) */
  receiverOrgRaw?: string;
  /** Resolved จาก DB Map (master organizations) */
  receiverOrgId?: number;
  /** ชื่อไฟล์ PDF แนบ — ว่าง = ลงทะเบียนล่วงหน้าไม่มีไฟล์แนบ (Edge case 4, D9) */
  fileName?: string;
  resolvedPdfPath?: string;
  remarks?: string;
  /** Findings ที่ Layer 1-3 พบของแถวนี้ (ว่าง = ผ่าน) */
  findings: ReviewFinding[];
}

/**
 * สรุปผลการตรวจทาน (ส่วนหนึ่งของ CheckReviewResponse
 * ตาม contracts/import-review-api.yaml)
 * canConfirm = false เมื่อมี BLOCK ค้างอยู่ (FR-015)
 */
export interface ReviewSummaryCounts {
  totalRows: number;
  passCount: number;
  warnCount: number;
  blockCount: number;
  aiSuggestCount: number;
  /** ยืนยันนำเข้าได้หรือไม่ (blockCount === 0) */
  canConfirm: boolean;
}

/** TTL ของ Review Session ใน Redis — 24 ชั่วโมง = 86400 วินาที (FR-012, D8) */
export const REVIEW_SESSION_TTL_SECONDS = 86400;

/** Redis key prefix ของ Review Session (data-model.md §1) */
export const REVIEW_SESSION_REDIS_PREFIX = 'import_review:session:';

/**
 * Prefix ของคอลัมน์ Audit ใน Annotated Excel (FR-010/FR-011, D4)
 * เช่น `[AI] Suggested Subject`, `[AI] Suggested Type`, `[AI] Review Notes`
 * ระบบเพิกเฉยคอลัมน์ที่ขึ้นต้นด้วย prefix นี้เมื่อผู้ใช้ Re-upload
 */
export const ANNOTATED_AUDIT_COLUMN_PREFIX = '[AI]';
