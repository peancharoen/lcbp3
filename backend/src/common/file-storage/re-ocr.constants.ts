// File: backend/src/common/file-storage/re-ocr.constants.ts
// Change Log
// - 2026-09-19: ADR-055 T002 — shared types + Redis key builders + TTL สำหรับ Attachment Manual Re-OCR
//   (ไฟล์นี้ห้าม import module อื่น เพื่อกัน circular import ระหว่าง file-storage ↔ ai processor)
// - 2026-09-19: review fix — เพิ่ม trigger mutex key กัน concurrent trigger (TOCTOU)
// - 2026-09-19: ADR-055 extension (D17–D22) — Production File Replace: pointer เก็บ
//   mode:'replace' + link/candidate fields (processor merge `...existing` preserve ไว้)

/** TTL ของทั้ง status pointer และ payload key (72 ชม. — ADR-055 D4) */
export const RE_OCR_TTL_SECONDS = 72 * 60 * 60;

/** TTL ของ trigger mutex — ครอบเฉพาะช่วง check-pointer + write-pointer + enqueue */
export const RE_OCR_TRIGGER_LOCK_TTL_SECONDS = 15;

/** สถานะของ re-OCR job ที่เก็บใน status pointer */
export type ReOcrStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** mode ของ job — ไม่มี field = plain re-OCR (D17); 'replace' = เปลี่ยนไฟล์ของ junction link */
export type ReOcrMode = 'replace';

/** แหล่งที่มาของ candidate file (D18) */
export type ReOcrCandidateSource = 'STAGING' | 'UPLOAD';

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
  // ── replace mode (D17–D22) — มีค่าเฉพาะ job ที่ trigger ผ่าน /re-ocr/replace ──
  /** 'replace' = junction-swap flow; undefined = plain re-OCR */
  mode?: ReOcrMode;
  /** correspondence เป้าหมาย — junction บน current revision ของมันคือ link ที่จะถูก swap */
  targetCorrespondencePublicId?: string;
  /** temp attachment ของ candidate file (preview + source ของ confirm) */
  candidateAttachmentPublicId?: string;
  /** ชื่อไฟล์ candidate — แสดงใน dialog + filename-mismatch warning (D21) */
  candidateFilename?: string;
  /** แหล่ง candidate (audit) */
  candidateSource?: ReOcrCandidateSource;
}

/** โครงสร้างของ payload เมื่อ OCR สำเร็จ (ADR-055 D4) */
export interface ReOcrPayload {
  newText: string;
  engineUsed: string;
  charCount: number;
  processingTimeMs: number;
  completedAt: string;
  // ── replace mode (D17–D22) — processor copy จาก job data มาไว้ใน payload
  //   เพื่อให้ confirm อ่าน context ได้จาก payload อย่างเดียว (pointer อาจหายก่อน) ──
  mode?: ReOcrMode;
  targetCorrespondencePublicId?: string;
  candidateAttachmentPublicId?: string;
  candidateFilename?: string;
  candidateSource?: ReOcrCandidateSource;
}
