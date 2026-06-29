// File: src/modules/ai/tool/types/server-intent.enum.ts
// Change Log
// - 2026-05-19: สร้าง ServerIntent enum สำหรับ AI Tool Layer (ADR-024, ADR-025).

/**
 * Server-side Intent codes ที่ AI Gateway รองรับ
 * ทุก Intent จะถูก map ไปยัง Tool Handler ใน AiToolRegistryService
 */
export enum ServerIntent {
  /** ดึงข้อมูล RFA สำหรับ LLM context */
  GET_RFA = 'GET_RFA',
  /** ดึงข้อมูล Drawing (Shop/As-Built) สำหรับ LLM context */
  GET_DRAWING = 'GET_DRAWING',
  /** ดึงข้อมูล Transmittal สำหรับ LLM context */
  GET_TRANSMITTAL = 'GET_TRANSMITTAL',
}
