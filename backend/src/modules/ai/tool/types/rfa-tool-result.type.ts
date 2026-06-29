// File: src/modules/ai/tool/types/rfa-tool-result.type.ts
// Change Log
// - 2026-05-19: สร้าง RfaToolResult DTO สำหรับ AI Tool Layer (ADR-019, ADR-025).

/**
 * ผลลัพธ์ RFA สำหรับ LLM Context
 * ปฏิบัติตาม ADR-019: ไม่มี Integer Primary Key (`id`),
 * ใช้เฉพาะ publicId และ Business Codes
 */
export interface RfaToolResult {
  /** UUID ของ RFA (ADR-019) */
  publicId: string;
  /** เลขที่เอกสาร RFA */
  rfaNumber: string;
  /** รหัส Revision */
  revisionCode: string;
  /** รหัสสถานะ เช่น DFT, FAP, APP */
  statusCode: string;
  /** จำนวน Drawing ที่อ้างอิง */
  drawingCount: number;
  /** วันที่ส่ง (ISO 8601 หรือ null) */
  submittedAt: string | null;
  /** วันที่ตอบกลับ (ISO 8601 หรือ null) */
  respondedAt: string | null;
  /** UUID ของ Contract ที่เกี่ยวข้อง (ADR-019) */
  contractPublicId: string;
}
