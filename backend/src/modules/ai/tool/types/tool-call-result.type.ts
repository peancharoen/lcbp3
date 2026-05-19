// File: src/modules/ai/tool/types/tool-call-result.type.ts
// Change Log
// - 2026-05-19: สร้าง ToolCallReason และ ToolCallResult<T> สำหรับ AI Tool Layer (ADR-025, ADR-007, ADR-019).

/**
 * ประเภทของ Reason เมื่อ Tool ทำงานไม่สำเร็จ
 * ตาม ADR-007 Layered Error Classification
 */
export type ToolCallReason =
  | 'FORBIDDEN' // ไม่มีสิทธิ์ (CASL fail)
  | 'NOT_FOUND' // ไม่พบข้อมูล
  | 'INVALID_PARAMS' // พารามิเตอร์ไม่ถูกต้อง
  | 'SERVICE_ERROR'; // ข้อผิดพลาดจาก Service layer

/**
 * ผลลัพธ์จากการเรียก Tool — Discriminated Union
 * ok: true  → data พร้อมใช้งาน
 * ok: false → reason บอกสาเหตุ, message สำหรับ LLM context
 */
export type ToolCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ToolCallReason; message: string };
