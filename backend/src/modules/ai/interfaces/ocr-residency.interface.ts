// File: backend/src/modules/ai/interfaces/ocr-residency.interface.ts
// Change Log:
// - 2026-06-11: Initial creation of OCR residency interfaces for AI runtime policy refactor

import { ExecutionProfile } from './execution-policy.interface';

/**
 * OCR runtime parameters based on np-dms-ocr model.
 * พารามิเตอร์ของระบบ OCR สำหรับ np-dms-ocr
 */
export interface OcrRuntimePolicy {
  canonicalModel: 'np-dms-ocr';
  numCtx: 8192;
  numPredict: 4096;
  temperature: 0.1;
  topP: 0.1;
  repeatPenalty: 1.1;
  keepAliveSeconds: number;
}

/**
 * Decision output for adaptive OCR residency.
 * ผลลัพธ์การตัดสินใจว่าควรโหลด OCR ค้างไว้ใน VRAM หรือไม่
 */
export interface OcrResidencyDecision {
  keepAliveSeconds: number;
  vramHeadroomMb: number;
  activeProfile: ExecutionProfile | null;
  reason:
    | 'deep-analysis-active'
    | 'high-pressure'
    | 'headroom-sufficient'
    | 'query-failed';
}
