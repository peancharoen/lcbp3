// File: backend/src/modules/ai/ai-rag.service.spec.ts
// Change Log:
// - 2026-06-05: สร้าง unit test สำหรับ AiRagService เพื่อทดสอบกระบวนการทำ RAG query ด้วย Hybrid Search และ Reranker (T011)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiRagService } from './ai-rag.service';
import { AiQdrantService } from './qdrant.service';
import { OcrService } from './services/ocr.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('AiRagService (US1 — Chat Q&A)', () => {
  let service: AiRagService;
  let qdrantService: AiQdrantService;
  let ocrService: OcrService;

  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown): unknown => {
      const values: Record<string, unknown> = {
        OLLAMA_URL: 'http://localhost:11434',
        OLLAMA_RAG_MODEL: 'typhoon2.5-np-dms:latest',
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRagService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AiQdrantService, useValue: mockQdrantService },
        { provide: OcrService, useValue: mockOcrService },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AiRagService>(AiRagService);
    qdrantService = module.get<AiQdrantService>(AiQdrantService);
    ocrService = module.get<OcrService>(OcrService);
    jest.clearAllMocks();
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
          model: 'typhoon2.5-np-dms:latest',
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
});
