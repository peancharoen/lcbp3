// File: backend/src/modules/ai/ai-rag.service.spec.ts
// Change Log:
// - 2026-06-05: สร้าง unit test สำหรับ AiRagService เพื่อทดสอบกระบวนการทำ RAG query ด้วย Hybrid Search และ Reranker (T011)
// - 2026-08-26: เพิ่ม regression test — unload BGE ก่อน LLM generate (D171, Fix 90e147fe)
// - 2026-09-12: T040 — เพิ่ม test สำหรับ stale-result skip, full-text fallback และ hybrid mode

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { AiRagService } from './ai-rag.service';
import { AiQdrantService } from './qdrant.service';
import { OcrService } from './services/ocr.service';
import { RagQueryLog } from './entities/rag-query-log.entity';
import { RagAttachmentChunk } from './entities/rag-attachment-chunk.entity';
import { RagRetrievalGuardService } from './services/rag-retrieval-guard.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

/** สร้าง chainable createQueryBuilder mock ที่ getMany คืนค่าตามที่กำหนด */
function makeQueryBuilderMock(
  getManyValue: unknown
): Record<string, jest.Mock> {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(getManyValue),
  };
}

describe('AiRagService (US1 — Chat Q&A)', () => {
  let service: AiRagService;
  let qdrantService: AiQdrantService;
  let ocrService: OcrService;
  let guardService: RagRetrievalGuardService;

  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown): unknown => {
      const values: Record<string, unknown> = {
        OLLAMA_URL: 'http://localhost:11434',
        OLLAMA_RAG_MODEL: 'np-dms-ai:latest',
        RAG_TIMEOUT_MS: 30000,
        RAG_CONTEXT_LIMIT_CHARS: 3000,
      };
      return values[key] ?? defaultValue;
    }),
  };

  const mockQdrantService = {
    searchByProject: jest.fn(),
  };

  const mockOcrService = {
    embedViaSidecar: jest.fn(),
    rerankViaSidecar: jest.fn(),
    unloadBgeModels: jest.fn().mockResolvedValue(undefined),
  };

  const mockRagQueryLogRepo = {
    create: jest.fn((data: unknown) => data),
    save: jest.fn().mockResolvedValue(undefined),
  };

  // Guard: default ให้ filterActiveChunksFromResults ส่ง input กลับทั้งหมด
  // (passthrough) เพื่อให้ test เดิมที่ไม่ได้ตั้งค่า guard ยังผ่าน
  const mockGuardService = {
    filterActiveChunksFromResults: jest.fn((results: unknown[]) =>
      Promise.resolve(results)
    ),
    filterActiveGenerations: jest.fn((uuids: string[]) =>
      Promise.resolve(uuids)
    ),
  };

  const mockChunkRepository = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRagService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AiQdrantService, useValue: mockQdrantService },
        { provide: OcrService, useValue: mockOcrService },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
        {
          provide: getRepositoryToken(RagQueryLog),
          useValue: mockRagQueryLogRepo,
        },
        { provide: RagRetrievalGuardService, useValue: mockGuardService },
        {
          provide: getRepositoryToken(RagAttachmentChunk),
          useValue: mockChunkRepository,
        },
      ],
    }).compile();

    service = module.get<AiRagService>(AiRagService);
    qdrantService = module.get<AiQdrantService>(AiQdrantService);
    ocrService = module.get<OcrService>(OcrService);
    guardService = module.get<RagRetrievalGuardService>(
      RagRetrievalGuardService
    );
    jest.clearAllMocks();
    // รีเซ็ต default passthrough หลัง clearAllMocks
    mockGuardService.filterActiveChunksFromResults.mockImplementation(
      (results: unknown[]) => Promise.resolve(results)
    );
    mockGuardService.filterActiveGenerations.mockImplementation(
      (uuids: string[]) => Promise.resolve(uuids)
    );
    // default: full-text search คืน empty เพื่อให้ test เดิม (vector มี chunks)
    // ไม่ถูก supplement → VECTOR mode ตามพฤติกรรมเดิม
    mockChunkRepository.createQueryBuilder.mockReturnValue(
      makeQueryBuilderMock([])
    );
  });

  describe('processQuery()', () => {
    it('ควรเรียกใช้ embedViaSidecar, searchByProject, rerankViaSidecar และจบด้วยการสร้างคำตอบด้วย LLM', async () => {
      // Setup mock data
      const mockDenseVector = Array(1024).fill(0.1);
      const mockSparseVector = { indices: [1, 2], values: [0.5, 0.6] };

      mockOcrService.embedViaSidecar.mockResolvedValueOnce({
        dense: mockDenseVector,
        sparse: mockSparseVector,
      });

      const mockQdrantResults = [
        {
          pointId: 'point-1',
          score: 0.85,
          payload: {
            doc_type: 'LETTER',
            doc_number: 'CORR-001',
            chunk_text: 'เนื้อหาเอกสารหน้าที่ 1 สำหรับทดสอบ RAG pipeline',
          },
        },
        {
          pointId: 'point-2',
          score: 0.72,
          payload: {
            doc_type: 'LETTER',
            doc_number: 'CORR-002',
            chunk_text: 'เนื้อหาเอกสารส่วนที่สองที่เกี่ยวข้องกัน',
          },
        },
      ];
      mockQdrantService.searchByProject.mockResolvedValueOnce(
        mockQdrantResults
      );

      mockOcrService.rerankViaSidecar.mockResolvedValueOnce({
        scores: [0.95, 0.45],
        ranked_indices: [0, 1],
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: 'คำตอบที่ได้รับความช่วยเหลือจาก LLM อ้างอิงเอกสาร CORR-001',
        },
      });

      // Run query
      await service.processQuery(
        'req-123',
        'ต้องการอนุมัติโครงการอย่างไร?',
        'proj-456',
        'user-789'
      );

      // Verify pipeline calls
      expect(ocrService.embedViaSidecar).toHaveBeenCalledWith(
        'ต้องการอนุมัติโครงการอย่างไร?'
      );
      expect(qdrantService.searchByProject).toHaveBeenCalledWith(
        mockDenseVector,
        mockSparseVector,
        'proj-456',
        15
      );
      expect(ocrService.rerankViaSidecar).toHaveBeenCalledWith(
        'ต้องการอนุมัติโครงการอย่างไร?',
        [
          'เนื้อหาเอกสารหน้าที่ 1 สำหรับทดสอบ RAG pipeline',
          'เนื้อหาเอกสารส่วนที่สองที่เกี่ยวข้องกัน',
        ]
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          model: 'np-dms-ai:latest',
          prompt: expect.stringContaining(
            'เนื้อหาเอกสารหน้าที่ 1 สำหรับทดสอบ RAG pipeline'
          ),
        }),
        expect.any(Object)
      );

      // Verify saving job status
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('ai:rag:result:req-123'),
        expect.any(Number),
        expect.stringContaining('completed')
      );
    });
  });

  // Regression (90e147fe / D171): BGE กิน GPU ~4.8GB ตลอดเวลา ทำให้ Ollama OOM
  // ต้อง unload BGE ผ่าน sidecar ก่อนเรียก /api/generate ทุกครั้ง
  describe('regression: BGE lazy-load / GPU coordination', () => {
    const setupSuccessfulPipeline = (): void => {
      mockOcrService.embedViaSidecar.mockResolvedValueOnce({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });
      mockQdrantService.searchByProject.mockResolvedValueOnce([
        {
          pointId: 'point-1',
          score: 0.9,
          payload: {
            doc_type: 'LETTER',
            doc_number: 'CORR-001',
            chunk_text: 'เนื้อหาเอกสารสำหรับทดสอบ GPU coordination',
          },
        },
      ]);
      mockOcrService.rerankViaSidecar.mockResolvedValueOnce({
        scores: [0.9],
        ranked_indices: [0],
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: 'คำตอบจาก LLM' },
      });
    };

    it('ควร unload BGE ก่อนเรียก Ollama generate เสมอ (คืน GPU memory กัน OOM)', async () => {
      setupSuccessfulPipeline();

      await service.processQuery(
        'req-bge-1',
        'คำถามทดสอบ?',
        'proj-456',
        'user-789'
      );

      expect(ocrService.unloadBgeModels).toHaveBeenCalledTimes(1);
      const unloadOrder = (ocrService.unloadBgeModels as jest.Mock).mock
        .invocationCallOrder[0];
      const generateOrder = mockedAxios.post.mock.invocationCallOrder[0];
      expect(unloadOrder).toBeLessThan(generateOrder);
    });

    it('ควร unload BGE หลัง rerank เท่านั้น — rerank ยังต้องใช้ BGE อยู่', async () => {
      setupSuccessfulPipeline();

      await service.processQuery(
        'req-bge-2',
        'คำถามทดสอบ?',
        'proj-456',
        'user-789'
      );

      const rerankOrder = (ocrService.rerankViaSidecar as jest.Mock).mock
        .invocationCallOrder[0];
      const unloadOrder = (ocrService.unloadBgeModels as jest.Mock).mock
        .invocationCallOrder[0];
      expect(rerankOrder).toBeLessThan(unloadOrder);
    });
  });

  // ─── T040: Stale-result skip + Full-text fallback + Hybrid mode ───────────────
  describe('T040 — stale-result skip & full-text fallback', () => {
    /** ตั้งค่า embed ให้สำเร็จเสมอ */
    const setupEmbed = (): void => {
      mockOcrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });
    };

    /** อ่าน job result ล่าสุดที่บันทึกลง Redis (ค้นหา call ล่าสุดที่มี result key) */
    const lastSavedResult = (): Record<string, unknown> => {
      const calls = mockRedis.setex.mock.calls as unknown[][];
      let resultCall: unknown[] | null = null;
      for (const c of calls) {
        if (String(c[0]).includes('ai:rag:result:')) {
          resultCall = c;
        }
      }
      return resultCall
        ? (JSON.parse(resultCall[2] as string) as Record<string, unknown>)
        : {};
    };

    it('ควรข้าม chunks จาก non-ACTIVE generations (stale skip) และ fall back สู่ full-text', async () => {
      setupEmbed();
      // Qdrant คืน chunks แต่ทั้งหมดจาก RETIRED generation → guard กรองออกหมด
      mockQdrantService.searchByProject.mockResolvedValueOnce([
        {
          pointId: 'p-stale',
          score: 0.9,
          payload: {
            chunk_public_id: 'chunk-stale',
            generation_uuid: 'gen-retired',
            chunk_text: 'เนื้อหาเก่าที่ล้าสมัย',
          },
        },
      ]);
      mockGuardService.filterActiveChunksFromResults.mockResolvedValueOnce([]);

      // Full-text fallback คืน chunks จาก ACTIVE generation
      mockChunkRepository.createQueryBuilder.mockReturnValueOnce(
        makeQueryBuilderMock([
          {
            chunkPublicId: 'chunk-ft-1',
            generationUuid: 'gen-active',
            attachmentUuid: 'att-1',
            content: 'เนื้อหาจาก full-text search',
            docType: 'LETTER',
            docNumber: 'CORR-001',
            projectPublicId: 'proj-456',
          },
        ])
      );
      mockGuardService.filterActiveGenerations.mockResolvedValueOnce([
        'gen-active',
      ]);

      mockOcrService.rerankViaSidecar.mockResolvedValueOnce({
        scores: [0.8],
        ranked_indices: [0],
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: 'คำตอบจาก full-text fallback' },
      });

      await service.processQuery(
        'req-stale-1',
        'คำถามเกี่ยวกับเอกสาร',
        'proj-456',
        'user-789'
      );

      // ตรวจว่า guard ถูกเรียกเพื่อกรอง stale chunks
      expect(guardService.filterActiveChunksFromResults).toHaveBeenCalled();
      // ตรวจว่า full-text search ถูกเรียก (fallback)
      expect(mockChunkRepository.createQueryBuilder).toHaveBeenCalled();
      // ตรวจ retrievalMode = FULL_TEXT
      const result = lastSavedResult();
      expect(result['status']).toBe('completed');
      expect(result['retrievalMode']).toBe('FULL_TEXT');
    });

    it('ควร fall back สู่ full-text เมื่อ Qdrant ไม่คืน valid ACTIVE chunks เลย', async () => {
      setupEmbed();
      // Qdrant คืน empty
      mockQdrantService.searchByProject.mockResolvedValueOnce([]);
      mockGuardService.filterActiveChunksFromResults.mockResolvedValueOnce([]);

      mockChunkRepository.createQueryBuilder.mockReturnValueOnce(
        makeQueryBuilderMock([
          {
            chunkPublicId: 'chunk-ft-2',
            generationUuid: 'gen-active-2',
            attachmentUuid: 'att-2',
            content: 'เนื้อหา full-text อีกกรณี',
            docType: 'RFA',
            docNumber: 'RFA-002',
            projectPublicId: 'proj-456',
          },
        ])
      );
      mockGuardService.filterActiveGenerations.mockResolvedValueOnce([
        'gen-active-2',
      ]);

      mockOcrService.rerankViaSidecar.mockResolvedValueOnce({
        scores: [0.7],
        ranked_indices: [0],
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: 'คำตอบจาก full-text' },
      });

      await service.processQuery(
        'req-ft-1',
        'คำถาม full-text',
        'proj-456',
        'user-789'
      );

      const result = lastSavedResult();
      expect(result['retrievalMode']).toBe('FULL_TEXT');
      // ตรวจว่า context ที่ส่งให้ LLM มีเนื้อหา full-text
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          prompt: expect.stringContaining('เนื้อหา full-text อีกกรณี'),
        }),
        expect.any(Object)
      );
    });

    it('ควรใช้ HYBRID mode เมื่อ vector มี valid chunks น้อย + full-text supplement', async () => {
      setupEmbed();
      // Vector คืน valid ACTIVE chunks เพียง 1 ตัว (ต่ำกว่า threshold=3)
      mockQdrantService.searchByProject.mockResolvedValueOnce([
        {
          pointId: 'p-vec-1',
          score: 0.85,
          payload: {
            chunk_public_id: 'chunk-vec-1',
            generation_uuid: 'gen-active',
            chunk_text: 'เนื้อหาจาก vector search',
            doc_type: 'LETTER',
            doc_number: 'CORR-001',
          },
        },
      ]);
      mockGuardService.filterActiveChunksFromResults.mockResolvedValueOnce([
        {
          pointId: 'p-vec-1',
          score: 0.85,
          payload: {
            chunk_public_id: 'chunk-vec-1',
            generation_uuid: 'gen-active',
            chunk_text: 'เนื้อหาจาก vector search',
            doc_type: 'LETTER',
            doc_number: 'CORR-001',
          },
        },
      ]);

      // Full-text supplement คืน chunk ใหม่ (ไม่ซ้ำ)
      mockChunkRepository.createQueryBuilder.mockReturnValueOnce(
        makeQueryBuilderMock([
          {
            chunkPublicId: 'chunk-ft-3',
            generationUuid: 'gen-active',
            attachmentUuid: 'att-3',
            content: 'เนื้อหาเสริมจาก full-text',
            docType: 'LETTER',
            docNumber: 'CORR-002',
            projectPublicId: 'proj-456',
          },
        ])
      );
      mockGuardService.filterActiveGenerations.mockResolvedValueOnce([
        'gen-active',
      ]);

      mockOcrService.rerankViaSidecar.mockResolvedValueOnce({
        scores: [0.9, 0.6],
        ranked_indices: [0, 1],
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: 'คำตอบ hybrid' },
      });

      await service.processQuery(
        'req-hybrid-1',
        'คำถาม hybrid',
        'proj-456',
        'user-789'
      );

      const result = lastSavedResult();
      expect(result['retrievalMode']).toBe('HYBRID');
      // ตรวจว่า full-text search ถูกเรียก (supplement)
      expect(mockChunkRepository.createQueryBuilder).toHaveBeenCalled();
      // ตรวจว่า rerank ได้รับ chunks จากทั้งสอง path (2 chunks)
      expect(ocrService.rerankViaSidecar).toHaveBeenCalledWith(
        'คำถาม hybrid',
        expect.arrayContaining([
          'เนื้อหาจาก vector search',
          'เนื้อหาเสริมจาก full-text',
        ])
      );
    });

    it('ควรใช้ VECTOR mode และไม่เรียก full-text เมื่อ vector มี valid chunks เพียงพอ', async () => {
      setupEmbed();
      // Vector คืน 3 valid ACTIVE chunks (≥ threshold)
      const vectorResults = [
        {
          pointId: 'p-1',
          score: 0.9,
          payload: {
            chunk_public_id: 'chunk-1',
            generation_uuid: 'gen-active',
            chunk_text: 'เนื้อหา vector 1',
            doc_type: 'LETTER',
            doc_number: 'CORR-001',
          },
        },
        {
          pointId: 'p-2',
          score: 0.8,
          payload: {
            chunk_public_id: 'chunk-2',
            generation_uuid: 'gen-active',
            chunk_text: 'เนื้อหา vector 2',
            doc_type: 'LETTER',
            doc_number: 'CORR-002',
          },
        },
        {
          pointId: 'p-3',
          score: 0.7,
          payload: {
            chunk_public_id: 'chunk-3',
            generation_uuid: 'gen-active',
            chunk_text: 'เนื้อหา vector 3',
            doc_type: 'LETTER',
            doc_number: 'CORR-003',
          },
        },
      ];
      mockQdrantService.searchByProject.mockResolvedValueOnce(vectorResults);
      mockGuardService.filterActiveChunksFromResults.mockResolvedValueOnce(
        vectorResults
      );

      mockOcrService.rerankViaSidecar.mockResolvedValueOnce({
        scores: [0.95, 0.7, 0.5],
        ranked_indices: [0, 1, 2],
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: 'คำตอบ vector' },
      });

      await service.processQuery(
        'req-vec-1',
        'คำถาม vector',
        'proj-456',
        'user-789'
      );

      const result = lastSavedResult();
      expect(result['retrievalMode']).toBe('VECTOR');
      // ตรวจว่าไม่ได้เรียก full-text search
      expect(mockChunkRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
