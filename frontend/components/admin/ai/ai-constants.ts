// File: frontend/components/admin/ai/ai-constants.ts
// Change Log:
// - 2026-08-02: แยก constants และ helper functions จาก AI Console page เพื่อ reuse ข้าม sub-pages
// - 2026-08-26: เพิ่ม BGE_MODEL_NAME สำหรับ BGE-M3 + Reranker (Sidecar lazy-load, ไม่ได้โหลดใน Ollama)
// - 2026-08-26: เพิ่ม MAIN_MODEL_30B_NAME สำหรับ np-dms-ai-30b (30B variant, optional Load/Unload)

export const MAIN_MODEL_NAME = 'np-dms-ai';
export const MAIN_MODEL_30B_NAME = 'np-dms-ai-30b';
export const OCR_MODEL_NAME = 'np-dms-ocr';
export const BGE_MODEL_NAME = 'bge-m3-reranker';

/**
 * แปลงชื่อโมเดลจาก runtime name เป็น canonical name
 * ต้องเช็ค 30b ก่อน np-dms-ai เพราะ "np-dms-ai-30b" มี "np-dms-ai" เป็น substring
 */
export function toCanonicalModel(rawName: string): string {
  const name = rawName.toLowerCase();
  if (name.includes(OCR_MODEL_NAME)) return OCR_MODEL_NAME;
  if (name.includes(MAIN_MODEL_30B_NAME)) return MAIN_MODEL_30B_NAME;
  if (name.includes(MAIN_MODEL_NAME)) return MAIN_MODEL_NAME;
  if (name.includes('bge')) return BGE_MODEL_NAME;
  return rawName;
}

/**
 * ตรวจสอบและแปลงค่าให้เป็น array อย่างปลอดภัย
 */
export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}
