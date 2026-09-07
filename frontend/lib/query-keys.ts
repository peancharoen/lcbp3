// File: lib/query-keys.ts
// บันทึกการแก้ไข: Centralized Query Key Registry for document actions (Feature 253 — T008)

/**
 * Query Key Registry สำหรับ document actions
 * ใช้ร่วมกันทุก document type — ป้องกัน key collision และทำให้ invalidation ถูกต้อง
 */

/** Base key สำหรับ document actions */
export const documentActionKeys = {
  all: ['document-actions'] as const,
  /** Key สำหรับ bulk operation progress */
  bulkProgress: (bulkId: string) =>
    [...documentActionKeys.all, 'bulk-progress', bulkId] as const,
  /** Key สำหรับ document detail (ใช้ invalidate หลัง action) */
  detail: (documentType: string, publicId: string) =>
    [...documentActionKeys.all, documentType.toLowerCase(), 'detail', publicId] as const,
  /** Key สำหรับ document list (ใช้ invalidate หลัง action) */
  lists: (documentType: string) =>
    [...documentActionKeys.all, documentType.toLowerCase(), 'list'] as const,
};

/** Helper สำหรับ invalidate ทุก key ที่เกี่ยวข้องกับ document action */
export function getInvalidationKeys(documentType: string, publicId: string) {
  return [
    documentActionKeys.detail(documentType, publicId),
    documentActionKeys.lists(documentType),
  ];
}
