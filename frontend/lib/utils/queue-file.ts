// File: lib/utils/queue-file.ts
// Change Log:
// - 2026-09-24: Initial — helpers อ่านสถานะไฟล์ต้นฉบับของ migration queue item
//   (details.attachments ที่ enrichWithAttachments ฉีดตอน serialize +
//   originalFilename/storageTempPath first-class columns)

import type { MigrationReviewQueueItem } from '@/types/migration';

type QueueItemLike = Pick<
  MigrationReviewQueueItem,
  'details' | 'originalFilename' | 'storageTempPath'
>;

/** shape ของ attachment metadata ที่ backend enrichWithAttachments ฉีดใน details */
export interface QueueAttachmentRef {
  publicId?: string;
  originalFilename?: string;
  mimeType?: string;
  hasOcrText?: boolean;
  isMainDocument?: boolean;
}

/** attachments ที่ผูกกับ queue item (อ่านจาก details.attachments อย่างปลอดภัย) */
export function getQueueAttachments(item: QueueItemLike): QueueAttachmentRef[] {
  const details = item.details;
  if (!details || typeof details !== 'object') return [];
  const attachments = (details as Record<string, unknown>)['attachments'];
  if (!Array.isArray(attachments)) return [];
  return attachments.filter(
    (a): a is QueueAttachmentRef => typeof a === 'object' && a !== null
  );
}

/**
 * พบไฟล์ต้นฉบับหรือไม่ — true เมื่อมี attachment record ผูกกับ queue item
 * (attachment ถูกสร้างเฉพาะตอน resolve PDF สำเร็จตอน ingestion;
 *  storageTempPath/originalFilename อาจมีแม้ไฟล์ resolve ไม่เจอ — rawFileName fallback)
 */
export function hasQueueFile(item: QueueItemLike): boolean {
  return getQueueAttachments(item).length > 0;
}

/**
 * ชื่อไฟล์ที่ควรแสดง — ลำดับ: main attachment filename → originalFilename
 * (ชื่อไฟล์ที่ register อ้างถึง) → basename ของ storageTempPath
 * คืน undefined เมื่อไม่มีข้อมูลชื่อไฟล์เลย
 */
export function getQueueFileName(item: QueueItemLike): string | undefined {
  const attachments = getQueueAttachments(item);
  const main =
    attachments.find((a) => a.isMainDocument) ?? attachments[0];
  if (typeof main?.originalFilename === 'string' && main.originalFilename.trim() !== '') {
    return main.originalFilename;
  }
  if (
    typeof item.originalFilename === 'string' &&
    item.originalFilename.trim() !== ''
  ) {
    return item.originalFilename;
  }
  const path = item.storageTempPath;
  if (typeof path === 'string' && path.trim() !== '') {
    const base = path.split('/').pop();
    if (base && base.trim() !== '') return base;
  }
  return undefined;
}
