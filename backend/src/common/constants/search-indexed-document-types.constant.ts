// File: backend/src/common/constants/search-indexed-document-types.constant.ts
// Change Log:
// - 2026-09-23: สร้างใหม่ — single source of truth สำหรับ document type ที่ถูก
//   index เข้า Elasticsearch (dms_documents) เดิม hardcode ซ้ำใน
//   document-side-effects.processor.ts และ document-hard-delete.service.ts
//   แยกกัน เสี่ยงลืมอัปเดตพร้อมกันเมื่อเพิ่ม document type ใหม่ที่ต้อง index

/**
 * Document type ที่ index เข้า Elasticsearch — RFA เป็น CTI subtype ของ
 * correspondences (shared PK), ไม่ใช่ตารางแยก
 */
export const SEARCH_INDEXED_DOCUMENT_TYPES: readonly string[] = [
  'CORRESPONDENCE',
  'RFA',
];
