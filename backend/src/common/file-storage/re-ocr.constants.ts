// File: backend/src/common/file-storage/re-ocr.constants.ts
// Change Log
// - 2026-09-19: ADR-055 T002 — shared types + Redis key builders + TTL สำหรับ Attachment Manual Re-OCR
//   (ไฟล์นี้ห้าม import module อื่น เพื่อกัน circular import ระหว่าง file-storage ↔ ai processor)
// - 2026-09-19: review fix — เพิ่ม trigger mutex key กัน concurrent trigger (TOCTOU)

/** TTL ของทั้ง status pointer และ payload key (72 ชม. — ADR-055 D4) */
export const RE_OCR_TTL_SECONDS = 72 * 60 * 60;

/** TTL ของ trigger mutex — ครอบเฉพาะช่วง check-pointer + write-pointer + enqueue */
export const RE_OCR_TRIGGER_LOCK_TTL_SECONDS = 15;

/** สถานะของ re-OCR job ที่เก็บใน status pointer */
export type ReOcrStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** Redis key ของ status pointer (job ล่าสุดของ attachment) */
export const reOcrPointerKey = (attachmentPublicId: string): string =>
  `attachment:re-ocr:${attachmentPublicId}`;

/** Redis key ของ trigger mutex (SET NX — ใครได้ lock เป็นคน trigger) */
export const reOcrTriggerLockKey = (attachmentPublicId: string): string =>
  `attachment:re-ocr:lock:${attachmentPublicId}`;

/** Redis key ของ payload (ผล OCR ใหม่ ผูกกับ token) */
export const reOcrPayloadKey = (
  attachmentPublicId: string,
  reOcrToken: string
): string => `attachment:re-ocr:${attachmentPublicId}:${reOcrToken}`;

/** โครงสร้างของ status pointer (ADR-055 D4) */
export interface ReOcrPointer {
  status: ReOcrStatus;
  reOcrToken: string;
  jobId: string;
  engineType: string;
  triggeredByDisplayName: string;
  triggeredAt: string;
  errorMessage?: string;
  attempt?: number;
  updatedAt: string;
}

/** โครงสร้างของ payload เมื่อ OCR สำเร็จ (ADR-055 D4) */
export interface ReOcrPayload {
  newText: string;
  engineUsed: string;
  charCount: number;
  processingTimeMs: number;
  completedAt: string;
}
