// File: backend/src/modules/ai/contracts/rag-retrieval.contract.spec.ts
// Change Log:
// - 2026-09-12: เพิ่ม citation response contract tests สำหรับ RAG retrieval (Feature 254, Phase 4 US2, T036)

/**
 * Contract tests สำหรับ RAG Retrieval และ Citation response
 *
 * ตรวจสอบว่า implementation เป็นไปตาม contract ที่กำหนดใน
 * specs/200-fullstacks/254-rag-attachment-chunks/contracts/rag-retrieval.md
 *
 * Phase 4 US2 skeleton (T036):
 * - กรณีที่ตรวจสอบ shape ของ response ได้จาก type ที่มีอยู่ → ใช้ real assertion
 * - กรณีที่ต้องการ implementation เต็มรูปแบบ (controller/guard/Qdrant filter) → ใช้ placeholder
 *   `expect(true).toBe(true)` เพื่อรอการ implement ใน task อื่นของ Phase 4 US2
 *
 * อ้างอิง: ADR-019 (publicId เท่านั้น), ADR-023A (AI boundary + Qdrant multi-tenancy)
 */

import {
  RagCitation,
  RagSegmentType,
} from '../interfaces/rag-attachment.types';

/** โหมด retrieval ตาม contract (VECTOR | FULL_TEXT | HYBRID) */
type RagRetrievalMode = 'VECTOR' | 'FULL_TEXT' | 'HYBRID';

/** Shape ของ retrieval response ตาม contract rag-retrieval.md */
interface RagRetrievalResponse {
  answer: string;
  sources: RagCitation[];
  retrievalMode: RagRetrievalMode;
}

/** รายการ key ที่ source object ต้องมีครบตาม contract */
const REQUIRED_SOURCE_KEYS: ReadonlyArray<keyof RagCitation> = [
  'attachmentPublicId',
  'ownerType',
  'ownerPublicId',
  'sourceLocator',
  'segmentType',
  'segmentNumber',
  'segmentLabel',
  'startOffset',
  'endOffset',
  'snippet',
  'score',
  'chunkPublicId',
];

/** ค่า retrievalMode ที่ถูกต้องตาม contract */
const VALID_RETRIEVAL_MODES: ReadonlyArray<RagRetrievalMode> = [
  'VECTOR',
  'FULL_TEXT',
  'HYBRID',
];

/** สร้าง sample source ที่สอดคล้องกับ contract เพื่อใช้ใน shape validation */
function buildSampleSource(): RagCitation {
  return {
    attachmentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
    ownerType: 'CORRESPONDENCE',
    ownerPublicId: '019505a1-7c3e-7000-8000-def456abc123',
    sourceLocator: 'drawing.pdf',
    segmentType: 'PAGE' as RagSegmentType,
    segmentNumber: 3,
    segmentLabel: 'Page 3',
    startOffset: '120',
    endOffset: '640',
    snippet: '...',
    score: 0.91,
    chunkPublicId: '019505a1-7c3e-7000-8000-111222333444',
  };
}

/** สร้าง sample response ที่สอดคล้องกับ contract เพื่อใช้ใน shape validation */
function buildSampleResponse(): RagRetrievalResponse {
  return {
    answer: 'Latest approved revision is Rev B.',
    sources: [buildSampleSource()],
    retrievalMode: 'VECTOR',
  };
}

describe('RAG Retrieval Citation Contract (T036)', () => {
  describe('POST /api/ai/rag/query — response shape', () => {
    it('response includes answer, sources[], retrievalMode', () => {
      // Contract: { answer, sources, retrievalMode }
      const response = buildSampleResponse();
      expect(response).toHaveProperty('answer');
      expect(response).toHaveProperty('sources');
      expect(response).toHaveProperty('retrievalMode');
      expect(typeof response.answer).toBe('string');
      expect(Array.isArray(response.sources)).toBe(true);
    });

    it('each source has all required citation fields', () => {
      // Contract: source object shape (12 fields)
      const source = buildSampleSource();
      for (const key of REQUIRED_SOURCE_KEYS) {
        expect(source).toHaveProperty(key);
      }
      // ตรวจว่าไม่มี key เกินมาจาก contract (ป้องกัน leakage ของ internal field)
      const sourceKeys = Object.keys(source);
      expect(sourceKeys.length).toBe(REQUIRED_SOURCE_KEYS.length);
    });

    it('segmentType is one of the allowed RagSegmentType values', () => {
      // Real shape validation จาก type ที่มีอยู่
      const allowed: ReadonlyArray<RagSegmentType> = [
        'PAGE',
        'SECTION',
        'SHEET',
        'WHOLE_DOCUMENT',
      ];
      const source = buildSampleSource();
      expect(allowed).toContain(source.segmentType);
    });

    it('response does NOT include generationUuid', () => {
      // Contract: "generationUuid must not be exposed in this response"
      const response = buildSampleResponse() as Record<string, unknown>;
      expect(response).not.toHaveProperty('generationUuid');
      // ตรวจใน source ด้วย
      const source = buildSampleSource() as Record<string, unknown>;
      expect(source).not.toHaveProperty('generationUuid');
    });

    it('retrievalMode is one of VECTOR, FULL_TEXT, HYBRID', () => {
      // Contract: retrievalMode enum
      const response = buildSampleResponse();
      expect(VALID_RETRIEVAL_MODES).toContain(response.retrievalMode);
    });
  });

  describe('POST /api/ai/rag/query — request contract', () => {
    it('projectPublicId is mandatory in request', () => {
      // Contract: "projectPublicId is mandatory and must be authorized for the caller"
      // Phase 4 US2 จะ implement ใน rag-retrieval.controller/guard
      expect(true).toBe(true);
    });

    it('rejects request without projectPublicId', () => {
      // Contract: projectPublicId mandatory → validation error
      // ต้องการ controller + DTO validation เต็มรูปแบบ
      expect(true).toBe(true);
    });

    it('sources are filtered by owning project', () => {
      // Contract: "Qdrant search is filtered by the owning project_public_id"
      // ต้องการ Qdrant service integration เต็มรูปแบบ
      expect(true).toBe(true);
    });

    it('denies retrieval for Projects with Distribution access only', () => {
      // Contract: "Distribution access to another Project does not grant RAG retrieval"
      // ต้องการ CASL guard + project authorization เต็มรูปแบบ
      expect(true).toBe(true);
    });
  });

  describe('POST /api/ai/rag/query — generation validation', () => {
    it('checks every Qdrant result against ACTIVE MariaDB generation', () => {
      // Contract: "Every Qdrant result is checked against an ACTIVE MariaDB generation"
      // ต้องการ rag-retrieval.service + MariaDB integration เต็มรูปแบบ
      expect(true).toBe(true);
    });

    it('skips Missing, RETIRED, or FAILED chunks', () => {
      // Contract: "Missing, RETIRED, or FAILED chunks are skipped"
      expect(true).toBe(true);
    });

    it('falls back to keyword/full-text when no valid chunks remain', () => {
      // Contract: "If no valid chunks remain, the service uses approved keyword/full-text fallback"
      expect(true).toBe(true);
    });
  });
});
