// File: lib/utils/queue-doc-number.ts
// Change Log:
// - 2026-09-24: Initial — helpers อ่านเลขเอกสารฐาน + revision label จาก queue item
//   details (revision-chain import: document_number เป็น staging key เช่น DOC-RA)

import type { MigrationReviewQueueItem } from '@/types/migration';

type QueueItemLike = Pick<MigrationReviewQueueItem, 'documentNumber' | 'details'>;

/**
 * เลขเอกสารฐานจริงของ queue item — อ่านจาก details.original_document_number
 * (เลขที่ register ตั้งใจ) fallback กลับ staging document_number สำหรับ
 * item เก่าที่ไม่มี key นี้ (staging key อาจมี suffix เช่น -RA, -R1, -D1)
 */
export function getQueueBaseDocNumber(item: QueueItemLike): string {
  const details = item.details;
  if (details && typeof details === 'object') {
    const original = (details as Record<string, unknown>)[
      'original_document_number'
    ];
    if (typeof original === 'string' && original.trim() !== '') {
      return original.trim();
    }
  }
  return item.documentNumber;
}

/**
 * revision label จริงจาก Excel column "revision" ('0','1','2','A','B',…)
 * — undefined เมื่อ item ไม่ได้มาจาก register ที่มี revision column
 * (ไม่อ่าน details.revision_number เพราะ key นั้นเป็น dedup counter ของ legacy)
 */
export function getQueueRevisionLabel(
  item: QueueItemLike
): string | undefined {
  const details = item.details;
  if (!details || typeof details !== 'object') return undefined;
  const label = (details as Record<string, unknown>)['revision_label'];
  if (typeof label === 'string' && label.trim() !== '') {
    return label.trim();
  }
  return undefined;
}

/**
 * ข้อความเลขเอกสารพร้อม revision สำหรับ string contexts (toast/description)
 * เช่น "DOC-001" หรือ "DOC-001 (Rev. B)"
 */
export function getQueueDocDisplayText(item: QueueItemLike): string {
  const base = getQueueBaseDocNumber(item);
  const rev = getQueueRevisionLabel(item);
  return rev !== undefined ? `${base} (Rev. ${rev})` : base;
}
