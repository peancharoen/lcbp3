// File: src/modules/ai/tool/types/transmittal-tool-result.type.ts
// Change Log
// - 2026-05-19: สร้าง TransmittalToolResult DTO สำหรับ AI Tool Layer (ADR-019, ADR-025).

/**
 * ผลลัพธ์ Transmittal สำหรับ LLM Context
 * ปฏิบัติตาม ADR-019: ไม่มี Integer Primary Key (`id`)
 */
export interface TransmittalToolResult {
  /** UUID ของ Transmittal (ADR-019) */
  publicId: string;
  /** เลขที่เอกสาร Transmittal */
  transmittalNumber: string;
  /** รหัสสถานะ */
  statusCode: string;
  /** หัวข้อ */
  subject: string;
  /** วันที่ออก */
  issuedAt: string | null;
  /** UUID ของ Project (ADR-019) */
  projectPublicId: string;
}
