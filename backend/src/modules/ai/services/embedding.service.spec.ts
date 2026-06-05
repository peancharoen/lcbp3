// File: backend/src/modules/ai/services/embedding.service.spec.ts
// Change Log:
// - 2026-06-05: สร้าง unit test สำหรับ EmbeddingService เพื่อทดสอบกระบวนการ Semantic Chunking และ fixed-size fallback (T024)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';
import { OllamaService } from './ollama.service';
import { AiQdrantService } from '../qdrant.service';
import { OcrService } from './ocr.service';
import { AiPromptsService } from '../prompts/ai-prompts.service';

describe('EmbeddingService (US3 — Semantic Chunking)', () => {
  let service: EmbeddingService;
  let ollamaService: OllamaService;
  let qdrantService: AiQdrantService;
  let ocrService: OcrService;
  let aiPromptsService: AiPromptsService;
  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown): unknown => {
      const values: Record<string, unknown> = {
        EMBEDDING_CHUNK_SIZE: 512,
        EMBEDDING_CHUNK_OVERLAP: 64,
      };
      return values[key] ?? defaultValue;
    }),
  };
  const mockOllamaService = {
    generate: jest.fn(),
  };
  const mockQdrantService = {
    deleteByDocumentPublicId: jest.fn().mockResolvedValue(undefined),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
  const mockOcrService = {
    embedViaSidecar: jest.fn(),
  };
  const mockAiPromptsService = {
    resolveActive: jest.fn(),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OllamaService, useValue: mockOllamaService },
        { provide: AiQdrantService, useValue: mockQdrantService },
        { provide: OcrService, useValue: mockOcrService },
        { provide: AiPromptsService, useValue: mockAiPromptsService },
      ],
    }).compile();
    service = module.get<EmbeddingService>(EmbeddingService);
    ollamaService = module.get<OllamaService>(OllamaService);
    qdrantService = module.get<AiQdrantService>(AiQdrantService);
    ocrService = module.get<OcrService>(OcrService);
    aiPromptsService = module.get<AiPromptsService>(AiPromptsService);
    jest.clearAllMocks();
  });
  describe('embedDocument()', () => {
    it('ควรเรียกใช้ Semantic Chunking เมื่อ LLM ตอบกลับถูกต้องตามแท็ก และบันทึกเข้า Qdrant สำเร็จ', async () => {
      const mockLlmResponse = `
        <chunk topic="การติดตั้งระบบ">ขั้นตอนการติดตั้งระบบมีดังนี้คือ 1. ตรวจสอบเครื่องมือ 2. เริ่มเชื่อมต่อ</chunk>
        <chunk topic="การตั้งค่า">หลังจากติดตั้งให้ทำการตั้งค่าระบบผ่านหน้าจอควบคุมหลัก</chunk>
      `;
      mockAiPromptsService.resolveActive.mockResolvedValueOnce({
        resolvedPrompt: 'mock resolved prompt',
        versionNumber: 1,
      });
      mockOllamaService.generate.mockResolvedValueOnce(mockLlmResponse);
      mockOcrService.embedViaSidecar.mockImplementation((_text: string) => {
        return Promise.resolve({
          dense: Array(1024).fill(0.1),
          sparse: { indices: [1], values: [0.5] },
        });
      });
      const result = await service.embedDocument(
        'proj-uuid-456',
        'doc-uuid-123',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Test Subject',
        '2026-06-05',
        'ข้อความทดสอบสำหรับการหั่นแบบ semantic chunking ซึ่งมีความยาวเกิน 50 ตัวอักษรอย่างแน่นอน'
      );
      expect(result.success).toBe(true);
      expect(result.chunksEmbedded).toBe(2);
      expect(aiPromptsService.resolveActive).toHaveBeenCalledWith(
        'rag_chunking',
        'ข้อความทดสอบสำหรับการหั่นแบบ semantic chunking ซึ่งมีความยาวเกิน 50 ตัวอักษรอย่างแน่นอน'
      );
      expect(ollamaService.generate).toHaveBeenCalledWith(
        'mock resolved prompt'
      );
      expect(ocrService.embedViaSidecar).toHaveBeenCalledTimes(2);
      expect(qdrantService.deleteByDocumentPublicId).toHaveBeenCalledWith(
        'proj-uuid-456',
        'doc-uuid-123'
      );
      expect(qdrantService.upsert).toHaveBeenCalled();
    });
    it('ควร fallback ไปใช้ fixed-size chunking เมื่อ LLM คืนข้อมูลที่ไม่มีแท็ก chunk หรือการเรียก LLM ล้มเหลว', async () => {
      mockAiPromptsService.resolveActive.mockResolvedValueOnce({
        resolvedPrompt: 'mock resolved prompt',
        versionNumber: 1,
      });
      mockOllamaService.generate.mockResolvedValueOnce(
        'ข้อความธรรมดาที่ไม่มีแท็ก chunk อะไรเลย'
      );
      mockOcrService.embedViaSidecar.mockImplementation((_text: string) => {
        return Promise.resolve({
          dense: Array(1024).fill(0.2),
          sparse: { indices: [2], values: [0.8] },
        });
      });
      const result = await service.embedDocument(
        'proj-uuid-456',
        'doc-uuid-123',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Test Subject',
        '2026-06-05',
        'ข้อความทดสอบแบบยาวเพื่อจำลองการทำ fixed size chunking สำหรับการ fallback เมื่อ LLM ทำงานไม่ได้ตามเงื่อนไขที่กำหนดไว้'
      );
      expect(result.success).toBe(true);
      expect(result.chunksEmbedded).toBeGreaterThan(0);
      expect(qdrantService.deleteByDocumentPublicId).toHaveBeenCalledWith(
        'proj-uuid-456',
        'doc-uuid-123'
      );
      expect(qdrantService.upsert).toHaveBeenCalled();
    });
  });
});
