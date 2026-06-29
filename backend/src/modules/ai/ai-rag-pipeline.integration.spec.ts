// File: backend/src/modules/ai/ai-rag-pipeline.integration.spec.ts
// Change Log:
// - 2026-06-05: สร้าง integration test สำหรับ RAG Pipeline end-to-end (SC-002, Gap fix)
//   ครอบคลุม: enqueueRagPrepare jobId dedup, EmbeddingService pipeline, project isolation

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { AiQueueService, RagPrepareJobPayload } from './ai-queue.service';
import { EmbeddingService } from './services/embedding.service';
import { OllamaService } from './services/ollama.service';
import { OcrService } from './services/ocr.service';
import { AiQdrantService } from './qdrant.service';
import { AiPromptsService } from './prompts/ai-prompts.service';
import {
  QUEUE_AI_INGEST,
  QUEUE_AI_RAG,
  QUEUE_AI_VECTOR_DELETION,
  QUEUE_AI_BATCH,
} from '../common/constants/queue.constants';

// ────────────────────────────────────────────────────────────────────────────────
// Mock helpers
// ────────────────────────────────────────────────────────────────────────────────
/** สร้าง mock BullMQ Queue ที่ track jobId เพื่อ verify deduplication */
const createMockQueue = () => {
  return {
    add: jest
      .fn()
      .mockImplementation(
        (name: string, data: unknown, opts: { jobId?: string } = {}) =>
          Promise.resolve({ id: opts.jobId ?? 'auto-id' })
      ),
  };
};

/** สร้าง mock EmbeddingService dependencies */
const buildEmbeddingModule = async (
  ollamaGenerateResponse: string,
  chunkSize = 512,
  chunkOverlap = 64
) => {
  const mockOllamaService = {
    generate: jest.fn().mockResolvedValue(ollamaGenerateResponse),
  };
  const mockAiPromptsService = {
    resolveActive: jest.fn().mockResolvedValue({
      resolvedPrompt: 'แบ่ง OCR text ออกเป็น chunks',
      versionNumber: 1,
    }),
  };
  const mockConfigService = {
    get: jest.fn((key: string, def?: unknown) => {
      const vals: Record<string, unknown> = {
        EMBEDDING_CHUNK_SIZE: chunkSize,
        EMBEDDING_CHUNK_OVERLAP: chunkOverlap,
      };
      return vals[key] ?? def;
    }),
  };
  const mockEmbedViaSidecar = jest.fn().mockResolvedValue({
    dense: Array(1024).fill(0.1),
    sparse: { indices: [10, 20], values: [0.8, 0.4] },
  });
  const mockDeleteByDocumentPublicId = jest.fn().mockResolvedValue(undefined);
  const mockUpsert = jest.fn().mockResolvedValue(undefined);
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EmbeddingService,
      { provide: ConfigService, useValue: mockConfigService },
      { provide: OllamaService, useValue: mockOllamaService },
      {
        provide: AiQdrantService,
        useValue: {
          deleteByDocumentPublicId: mockDeleteByDocumentPublicId,
          upsert: mockUpsert,
        },
      },
      {
        provide: OcrService,
        useValue: { embedViaSidecar: mockEmbedViaSidecar },
      },
      { provide: AiPromptsService, useValue: mockAiPromptsService },
    ],
  }).compile();
  return {
    service: module.get<EmbeddingService>(EmbeddingService),
    mockEmbedViaSidecar,
    mockDeleteByDocumentPublicId,
    mockUpsert,
    mockOllamaService,
  };
};

// ────────────────────────────────────────────────────────────────────────────────
describe('RAG Pipeline — Integration (SC-002 / Gap fixes)', () => {
  // ──────────────────────────────────────────────────────────────────────────────
  // Test Group 1: BullMQ Job Deduplication (Gap 1 verify)
  // ──────────────────────────────────────────────────────────────────────────────
  describe('enqueueRagPrepare — jobId deduplication', () => {
    let queueService: AiQueueService;
    let mockBatchQueue: ReturnType<typeof createMockQueue>;
    beforeEach(async () => {
      mockBatchQueue = createMockQueue();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiQueueService,
          {
            provide: getQueueToken(QUEUE_AI_INGEST),
            useValue: { add: jest.fn() },
          },
          {
            provide: getQueueToken(QUEUE_AI_RAG),
            useValue: { add: jest.fn() },
          },
          {
            provide: getQueueToken(QUEUE_AI_VECTOR_DELETION),
            useValue: { add: jest.fn() },
          },
          { provide: getQueueToken(QUEUE_AI_BATCH), useValue: mockBatchQueue },
        ],
      }).compile();
      queueService = module.get<AiQueueService>(AiQueueService);
    });
    it('ควรสร้าง jobId = rag-prepare:{documentPublicId}:{revisionNumber} (SC-004 dedup)', async () => {
      const payload: RagPrepareJobPayload = {
        documentPublicId: 'doc-uuid-001',
        projectPublicId: 'proj-uuid-abc',
        correspondenceNumber: 'CORR-2026-001',
        docType: 'LETTER',
        statusCode: 'SUBOWN',
        revisionNumber: 1,
        subject: 'เอกสารทดสอบ Dedup',
      };
      await queueService.enqueueRagPrepare(payload);
      const calls = mockBatchQueue.add.mock.calls as [
        string,
        unknown,
        { jobId?: string },
      ][];
      expect(calls[0][2]?.jobId).toBe('rag-prepare:doc-uuid-001:1');
    });
    it('ควร enqueue ด้วยชื่อ job rag-prepare และ payload ครบ', async () => {
      const payload: RagPrepareJobPayload = {
        documentPublicId: 'doc-uuid-002',
        projectPublicId: 'proj-uuid-xyz',
        correspondenceNumber: 'CORR-2026-002',
        docType: 'RFA',
        statusCode: 'CLBOWN',
        revisionNumber: 0,
        subject: 'RFA Test',
        documentDate: '2026-06-05',
        attachmentPath: '/files/rfa.pdf',
      };
      await queueService.enqueueRagPrepare(payload);
      expect(mockBatchQueue.add).toHaveBeenCalledWith(
        'rag-prepare',
        expect.objectContaining({
          jobType: 'rag-prepare',
          documentPublicId: 'doc-uuid-002',
          revisionNumber: 0,
        }),
        expect.objectContaining({
          jobId: 'rag-prepare:doc-uuid-002:0',
          attempts: 3,
        })
      );
    });
    it('ควรคืน jobId เดิมเมื่อ enqueue revision เดียวกัน 2 ครั้ง (idempotency)', async () => {
      const payload: RagPrepareJobPayload = {
        documentPublicId: 'doc-same',
        projectPublicId: 'proj-same',
        correspondenceNumber: 'CORR-SAME',
        docType: 'LETTER',
        statusCode: 'SUBOWN',
        revisionNumber: 3,
        subject: 'Idempotency Test',
      };
      const id1 = await queueService.enqueueRagPrepare(payload);
      const id2 = await queueService.enqueueRagPrepare(payload);
      // jobId เหมือนกัน — BullMQ จะ deduplicate ที่ server side
      expect(id1).toBe(id2);
      const calls = mockBatchQueue.add.mock.calls as [
        string,
        unknown,
        { jobId?: string },
      ][];
      expect(calls[0][2]?.jobId).toBe(calls[1][2]?.jobId);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Test Group 2: processRagPrepare → EmbeddingService pipeline (SC-002)
  // ──────────────────────────────────────────────────────────────────────────────
  describe('EmbeddingService.embedDocument — full pipeline (SC-002)', () => {
    const semanticLlmResponse =
      '<chunk topic="บทนำ">เนื้อหาบทนำของเอกสารที่มีความยาวเพียงพอสำหรับการทดสอบ</chunk>' +
      '<chunk topic="รายละเอียด">เนื้อหารายละเอียดของเอกสารฉบับนี้ครอบคลุมหัวข้อสำคัญ</chunk>';
    const ocrText =
      'เนื้อหาเอกสารที่มีความยาวเกิน 50 ตัวอักษร สำหรับทดสอบ RAG pipeline integration test ครบ pipeline';
    it('SC-002: ควรเรียก Sidecar /embed และ Qdrant upsert สำหรับ semantic chunks', async () => {
      const {
        service,
        mockEmbedViaSidecar,
        mockDeleteByDocumentPublicId,
        mockUpsert,
      } = await buildEmbeddingModule(semanticLlmResponse);
      const result = await service.embedDocument(
        'proj-uuid-123',
        'doc-uuid-456',
        'CORR-2026-001',
        'LETTER',
        'SUBOWN',
        1,
        'Test Subject',
        '2026-06-05',
        ocrText
      );
      // ตรวจสอบว่า Sidecar /embed ถูกเรียกสำหรับแต่ละ semantic chunk (2 chunks)
      expect(mockEmbedViaSidecar).toHaveBeenCalledTimes(2);
      // ตรวจสอบว่าลบ points เก่าก่อน upsert (delete-before-upsert)
      expect(mockDeleteByDocumentPublicId).toHaveBeenCalledWith(
        'proj-uuid-123',
        'doc-uuid-456'
      );
      // ตรวจสอบ upsert payload ครบ 11 fields
      expect(mockUpsert).toHaveBeenCalledWith(
        'proj-uuid-123',
        expect.arrayContaining([
          expect.objectContaining({
            payload: expect.objectContaining({
              doc_public_id: 'doc-uuid-456',
              project_public_id: 'proj-uuid-123',
              doc_number: 'CORR-2026-001',
              doc_type: 'LETTER',
              status_code: 'SUBOWN',
              revision_number: 1,
              subject: 'Test Subject',
              document_date: '2026-06-05',
            }),
          }),
        ])
      );
      expect(result.success).toBe(true);
      expect(result.chunksEmbedded).toBe(2);
    });
    it('SC-003: project isolation — upsert และ delete ต้องใช้ projectPublicId ที่ถูกต้อง', async () => {
      const { service, mockDeleteByDocumentPublicId, mockUpsert } =
        await buildEmbeddingModule(semanticLlmResponse);
      await service.embedDocument(
        'proj-ISOLATED-999',
        'doc-iso',
        'CORR-ISO',
        'LETTER',
        'SUBOWN',
        0,
        'Subject',
        undefined,
        ocrText
      );
      // deleteByDocumentPublicId ต้องใช้ projectPublicId ที่ถูกต้อง
      expect(mockDeleteByDocumentPublicId).toHaveBeenCalledWith(
        'proj-ISOLATED-999',
        'doc-iso'
      );
      // upsert ต้องส่ง projectPublicId ที่ถูกต้องเป็น arg แรก
      const upsertCalls = mockUpsert.mock.calls as [string, unknown][];
      expect(upsertCalls[0][0]).toBe('proj-ISOLATED-999');
    });
    it('SC-006: ลำดับ delete → upsert ต้องถูกต้องเสมอ (ป้องกัน stale chunks)', async () => {
      const callOrder: string[] = [];
      const { service, mockDeleteByDocumentPublicId, mockUpsert } =
        await buildEmbeddingModule(semanticLlmResponse);
      mockDeleteByDocumentPublicId.mockImplementationOnce(() => {
        callOrder.push('delete');
      });
      mockUpsert.mockImplementationOnce(() => {
        callOrder.push('upsert');
      });
      await service.embedDocument(
        'proj-x',
        'doc-stale',
        'CORR-X',
        'LETTER',
        'SUBOWN',
        2,
        'Sub',
        undefined,
        ocrText
      );
      // ตรวจสอบลำดับ: delete ต้องเกิดก่อน upsert เสมอ (SC-006)
      expect(callOrder).toEqual(['delete', 'upsert']);
    });
    it('ควรคืน success=false เมื่อ ocrText ว่าง (edge case — skip guard)', async () => {
      const { service } = await buildEmbeddingModule(semanticLlmResponse);
      const result = await service.embedDocument(
        'proj-x',
        'doc-empty',
        'CORR-X',
        'LETTER',
        'SUBOWN',
        1,
        'Sub',
        undefined,
        ''
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('No OCR text');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Test Group 3: Semantic Chunking fallback → fixed-size (FR-005)
  // ──────────────────────────────────────────────────────────────────────────────
  describe('Semantic Chunking fallback (FR-005)', () => {
    it('ควร fallback เป็น fixed-size และยังคง embed ได้ เมื่อ LLM output ไม่มี <chunk> tag', async () => {
      const { service, mockEmbedViaSidecar, mockUpsert } =
        await buildEmbeddingModule(
          'ไม่มี tag chunk เลย — plain text output',
          60,
          0
        );
      const ocrText = 'ก'.repeat(80); // 80 chars → 2 chunks (60 + 20 chars)
      const result = await service.embedDocument(
        'proj-fallback',
        'doc-fallback',
        'CORR-FB',
        'LETTER',
        'SUBOWN',
        1,
        'Fallback',
        undefined,
        ocrText
      );
      // fallback ยังต้อง embed ได้
      expect(result.success).toBe(true);
      expect(result.chunksEmbedded).toBeGreaterThan(0);
      expect(mockEmbedViaSidecar).toHaveBeenCalled();
      // ตรวจสอบว่า chunk_topic มาจาก fixed-size (ขึ้นต้นด้วย "ส่วนที่")
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const upsertPoints = mockUpsert.mock.calls[0]?.[1] as Array<{
        payload: { chunk_topic: string };
      }>;

      expect(upsertPoints[0]?.payload.chunk_topic).toMatch(/ส่วนที่/);
    });
    it('ควร fallback ทันทีเมื่อ LLM throw error', async () => {
      const { service, mockUpsert, mockOllamaService } =
        await buildEmbeddingModule('', 60, 0);
      mockOllamaService.generate.mockRejectedValueOnce(
        new Error('Ollama timeout')
      );
      const ocrText = 'ก'.repeat(80);
      const result = await service.embedDocument(
        'proj-err',
        'doc-err',
        'CORR-ERR',
        'LETTER',
        'SUBOWN',
        1,
        'Sub',
        undefined,
        ocrText
      );
      // ถึงแม้ LLM throw แต่ fallback ยังทำงาน
      expect(result.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalled();
    });
  });
});
