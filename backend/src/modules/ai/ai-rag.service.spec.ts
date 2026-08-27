// File: backend/src/modules/ai/ai-rag.service.spec.ts
// Change Log:
// - 2026-06-05: สร้าง unit test สำหรับ AiRagService เพื่อทดสอบกระบวนการทำ RAG query ด้วย Hybrid Search และ Reranker (T011)
// - 2026-08-26: เพิ่ม regression test — unload BGE ก่อน LLM generate (D171, Fix 90e147fe)

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
});
