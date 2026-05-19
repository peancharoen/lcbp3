// File: src/modules/ai/tool/types/drawing-tool-result.type.ts
// Change Log
// - 2026-05-19: สร้าง DrawingToolResult DTO สำหรับ AI Tool Layer (ADR-019, ADR-025).

/**
 * ผลลัพธ์ Drawing สำหรับ LLM Context
 * ปฏิบัติตาม ADR-019: ไม่มี Integer Primary Key (`id`)
 */
export interface DrawingToolResult {
  /** UUID ของ Drawing (ADR-019) */
  publicId: string;
  /** เลขที่ Drawing */
  drawingNumber: string;
  /** ชื่อ Drawing */
  title: string;
  /** รหัสสถานะ เช่น ACTIVE, SUPERSEDED */
  statusCode: string;
  /** ประเภท Drawing: SHOP หรือ AS_BUILT */
  drawingType: 'SHOP' | 'AS_BUILT';
  /** Revision ล่าสุด */
  latestRevision: string | null;
  /** UUID ของ Contract (ADR-019) */
  contractPublicId: string;
}
