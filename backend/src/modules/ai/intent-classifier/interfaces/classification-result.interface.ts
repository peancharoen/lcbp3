// File: src/modules/ai/intent-classifier/interfaces/classification-result.interface.ts
// Change Log
// - 2026-05-19: สร้าง interfaces สำหรับ Intent Classification System (ADR-024).

/** วิธีที่ใช้ในการจำแนก Intent */
export type ClassificationMethod =
  | 'pattern'
  | 'llm_fallback'
  | 'semaphore_overflow'
  | 'llm_error';

/**
 * ผลลัพธ์การจำแนก Intent
 * method: วิธีที่ใช้จำแนก (pattern match หรือ LLM fallback)
 */
export interface ClassificationResult {
  /** Intent code ที่จำแนกได้ เช่น 'SUMMARIZE_DOCUMENT', 'GET_RFA' */
  intentCode: string;
  /** ความมั่นใจ 0.0-1.0 (1.0 = pattern match, < 1.0 = LLM) */
  confidence: number;
  /** วิธีที่ใช้จำแนก */
  method: ClassificationMethod;
  /** Parameters ที่สกัดได้จาก query (optional) */
  params?: Record<string, unknown>;
  /** เวลาที่ใช้ทั้งหมด (milliseconds) */
  latencyMs: number;
}

/**
 * Input สำหรับการจำแนก Intent
 */
export interface ClassificationInput {
  /** คำถามจาก user (trim แล้ว, max 200 chars) */
  query: string;
  /** Context project UUID (optional) */
  projectPublicId?: string;
  /** Context user UUID (optional) */
  userPublicId?: string;
  /** Document ที่เปิดอยู่ UUID (optional) */
  currentDocumentId?: string;
}

/**
 * ข้อมูล Pattern ที่ใช้ใน matching (flatten จาก DB สำหรับ cache)
 */
export interface CachedPattern {
  /** Public UUID ของ pattern */
  publicId: string;
  /** Intent code ที่ pattern นี้เป็นของ */
  intentCode: string;
  /** ภาษา: th, en, any */
  language: 'th' | 'en' | 'any';
  /** ชนิด pattern */
  patternType: 'keyword' | 'regex';
  /** ค่า pattern (keyword string หรือ regex string) */
  patternValue: string;
  /** ลำดับการตรวจสอบ (ต่ำ = สำคัญกว่า) */
  priority: number;
}
