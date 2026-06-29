// File: src/modules/ai/intent-classifier/interfaces/intent-category.enum.ts
// Change Log
// - 2026-05-19: สร้าง Enum สำหรับ Intent Category, Pattern Type, Pattern Language (ADR-024).

/** หมวดหมู่ของ Intent */
export enum IntentCategory {
  READ = 'read', // ดึงข้อมูล: RAG_QUERY, GET_RFA, etc.
  SUGGEST = 'suggest', // แนะนำ: SUGGEST_METADATA, SUGGEST_ACTION
  UTILITY = 'utility', // อื่น ๆ: FALLBACK
}

/** ชนิดของ Pattern ที่ใช้ในการ match */
export enum PatternType {
  KEYWORD = 'keyword', // case-insensitive string includes()
  REGEX = 'regex', // RegExp.test()
}

/** ภาษาที่ Pattern รองรับ */
export enum PatternLanguage {
  TH = 'th', // ภาษาไทย
  EN = 'en', // ภาษาอังกฤษ
  ANY = 'any', // ทุกภาษา
}
