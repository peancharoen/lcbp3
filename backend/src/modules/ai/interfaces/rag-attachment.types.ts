// File: backend/src/modules/ai/interfaces/rag-attachment.types.ts
// Change Log:
// - 2026-09-09: เพิ่ม types สำหรับ TextSegment และ RAG Attachment generation (Feature 254)

/** ประเภท source segment ที่ citation รองรับ */
export type RagSegmentType = 'PAGE' | 'SECTION' | 'SHEET' | 'WHOLE_DOCUMENT';

/** สถานะ lifecycle ของ generation */
export type RagGenerationStatus = 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';

/** ข้อมูลข้อความที่ normalize แล้วก่อน semantic chunking */
export interface RagTextSegment {
  segmentType: RagSegmentType;
  segmentNumber?: number;
  segmentLabel?: string;
  sourceLocator?: string;
  text: string;
}

/** Citation ที่ปลอดภัยสำหรับส่งกลับ frontend */
export interface RagCitation {
  attachmentPublicId: string;
  ownerType: string;
  ownerPublicId: string;
  sourceLocator?: string;
  segmentType: RagSegmentType;
  segmentNumber?: number;
  segmentLabel?: string;
  startOffset: string;
  endOffset: string;
  snippet: string;
  score: number;
  chunkPublicId: string;
}

/** Schema ของ embedding แบบ dense+sparse */
export interface RagEmbeddingSchema {
  denseDimensions: number;
  sparse: boolean;
  model: string;
}
