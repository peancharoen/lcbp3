// File: backend/src/modules/ai/services/embedding.service.spec.ts
// Change Log:
// - 2026-06-05: สร้าง unit test สำหรับ EmbeddingService เพื่อทดสอบกระบวนการ Semantic Chunking และ fixed-size fallback (T024)
// - 2026-08-26: เพิ่ม regression test — Qdrant point ID ต้องเป็น UUIDv4 (Fix a35f0227)

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

  // Regression (a35f0227): Qdrant รับ point ID เป็น unsigned integer หรือ UUID เท่านั้น
  // รูปแบบเดิม `${documentPublicId}-${chunkIndex}` ถูกปฏิเสธ ทำให้ embed-document ล้มเหลวทุกครั้ง
  describe('regression: Qdrant point ID ต้องเป็น UUID', () => {
    const UUID_V4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    it('ควรสร้าง point ID เป็น UUIDv4 ที่ไม่ซ้ำกัน และไม่ใช้รูปแบบ documentPublicId-chunkIndex', async () => {
      mockAiPromptsService.resolveActive.mockResolvedValueOnce({
        resolvedPrompt: 'mock resolved prompt',
        versionNumber: 1,
      });
      mockOllamaService.generate.mockResolvedValueOnce(`
        <chunk topic="หัวข้อแรก">เนื้อหาส่วนแรกของเอกสารที่ใช้ทดสอบการสร้าง point id</chunk>
        <chunk topic="หัวข้อสอง">เนื้อหาส่วนที่สองของเอกสารที่ใช้ทดสอบการสร้าง point id</chunk>
      `);
      mockOcrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });

      await service.embedDocument(
        'proj-uuid-456',
        'doc-uuid-123',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Test Subject',
        '2026-06-05',
        'ข้อความทดสอบสำหรับการสร้าง point id ซึ่งมีความยาวเกิน 50 ตัวอักษรอย่างแน่นอน'
      );

      const [, points] = (qdrantService.upsert as jest.Mock).mock.calls[0] as [
        string,
        Array<{ id: string; payload: Record<string, unknown> }>,
      ];
      expect(points).toHaveLength(2);
      for (const point of points) {
        expect(point.id).toMatch(UUID_V4);
        expect(point.id).not.toContain('doc-uuid-123');
      }
      expect(new Set(points.map((p) => p.id)).size).toBe(2);
      // doc_public_id ต้องยังอยู่ใน payload เพื่อใช้ filter/ลบ vector ของเอกสาร
      expect(points[0].payload['doc_public_id']).toBe('doc-uuid-123');
      expect(points[0].payload['chunk_index']).toBe(0);
      expect(points[1].payload['chunk_index']).toBe(1);
    });
  });

  describe('edge cases and error paths', () => {
    it('ควรคืน failure เมื่อไม่มี OCR text', async () => {
      const result = await service.embedDocument(
        'proj-uuid',
        'doc-uuid',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Subject',
        '2026-06-05',
        ''
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No OCR text provided');
    });

    it('ควรคืน failure เมื่อ OCR text เป็น whitespace อย่างเดียว', async () => {
      const result = await service.embedDocument(
        'proj-uuid',
        'doc-uuid',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Subject',
        '2026-06-05',
        '   '
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No OCR text provided');
    });

    it('ควรตั้ง device เป็น cpu เมื่อ embed คืน cpu', async () => {
      mockAiPromptsService.resolveActive.mockResolvedValueOnce({
        resolvedPrompt: 'prompt',
        versionNumber: 1,
      });
      mockOllamaService.generate.mockResolvedValueOnce(
        '<chunk topic="test">ข้อความทดสอบสำหรับการ embed ผ่าน cpu device</chunk>'
      );
      mockOcrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
        device: 'cpu',
      });

      const result = await service.embedDocument(
        'proj-uuid',
        'doc-uuid',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Subject',
        '2026-06-05',
        'ข้อความทดสอบสำหรับการ embed ผ่าน cpu device ที่มีความยาวเกินพอดี'
      );

      expect(result.success).toBe(true);
      expect(result.device).toBe('cpu');
    });

    it('ควรข้าม chunk ที่ embed ล้มเหลว แต่ยัง embed chunk อื่นได้', async () => {
      mockAiPromptsService.resolveActive.mockResolvedValueOnce({
        resolvedPrompt: 'prompt',
        versionNumber: 1,
      });
      mockOllamaService.generate.mockResolvedValueOnce(`
        <chunk topic="chunk1">ข้อความส่วนแรกที่มีความยาวเพียงพอ</chunk>
        <chunk topic="chunk2">ข้อความส่วนที่สองที่มีความยาวเพียงพอ</chunk>
      `);
      mockOcrService.embedViaSidecar
        .mockRejectedValueOnce(new Error('embed failed'))
        .mockResolvedValueOnce({
          dense: Array(1024).fill(0.1),
          sparse: { indices: [1], values: [0.5] },
        });

      const result = await service.embedDocument(
        'proj-uuid',
        'doc-uuid',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Subject',
        '2026-06-05',
        'ข้อความทดสอบสำหรับการ embed ที่มี chunk ล้มเหลวบางส่วน'
      );

      expect(result.success).toBe(true);
      expect(result.chunksEmbedded).toBe(1);
    });

    it('ควรคืน failure เมื่อทุก chunk embed ล้มเหลว', async () => {
      mockAiPromptsService.resolveActive.mockResolvedValueOnce({
        resolvedPrompt: 'prompt',
        versionNumber: 1,
      });
      mockOllamaService.generate.mockResolvedValueOnce(
        '<chunk topic="chunk1">ข้อความส่วนเดียวที่ embed ล้มเหลว</chunk>'
      );
      mockOcrService.embedViaSidecar.mockRejectedValue(new Error('all failed'));

      const result = await service.embedDocument(
        'proj-uuid',
        'doc-uuid',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Subject',
        '2026-06-05',
        'ข้อความทดสอบสำหรับการ embed ที่ทุก chunk ล้มเหลว'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('All chunks failed to embed');
    });

    it('ควรคืน failure เมื่อ qdrant upsert ล้มเหลว', async () => {
      mockAiPromptsService.resolveActive.mockResolvedValueOnce({
        resolvedPrompt: 'prompt',
        versionNumber: 1,
      });
      mockOllamaService.generate.mockResolvedValueOnce(
        '<chunk topic="test">ข้อความทดสอบที่ qdrant ล้มเหลว</chunk>'
      );
      mockOcrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });
      mockQdrantService.deleteByDocumentPublicId.mockRejectedValueOnce(
        new Error('Qdrant connection lost')
      );

      const result = await service.embedDocument(
        'proj-uuid',
        'doc-uuid',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Subject',
        '2026-06-05',
        'ข้อความทดสอบที่ qdrant ล้มเหลว มีความยาวเพียงพอ'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Qdrant connection lost');
    });

    it('ควรคืน failure เมื่อ qdrant reject ด้วย non-Error', async () => {
      mockAiPromptsService.resolveActive.mockResolvedValueOnce({
        resolvedPrompt: 'prompt',
        versionNumber: 1,
      });
      mockOllamaService.generate.mockResolvedValueOnce(
        '<chunk topic="test">ข้อความทดสอบ non-error rejection</chunk>'
      );
      mockOcrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });
      mockQdrantService.deleteByDocumentPublicId.mockRejectedValueOnce(
        'string-error'
      );

      const result = await service.embedDocument(
        'proj-uuid',
        'doc-uuid',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Subject',
        '2026-06-05',
        'ข้อความทดสอบ non-error rejection มีความยาวเพียงพอ'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('string-error');
    });

    it('ควร fallback เป็น fixed-size เมื่อ semantic chunking throw Error', async () => {
      mockAiPromptsService.resolveActive.mockRejectedValueOnce(
        new Error('Prompt service unavailable')
      );
      mockOcrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });

      const result = await service.embedDocument(
        'proj-uuid',
        'doc-uuid',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Subject',
        '2026-06-05',
        'ข้อความทดสอบเมื่อ semantic chunking throw error แล้ว fallback ไป fixed-size'
      );

      expect(result.success).toBe(true);
      expect(result.chunksEmbedded).toBeGreaterThan(0);
    });

    it('ควร fallback เป็น fixed-size เมื่อ semantic chunking throw non-Error', async () => {
      mockAiPromptsService.resolveActive.mockRejectedValueOnce('non-error');
      mockOcrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });

      const result = await service.embedDocument(
        'proj-uuid',
        'doc-uuid',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Subject',
        '2026-06-05',
        'ข้อความทดสอบเมื่อ semantic chunking throw non-error แล้ว fallback ไป fixed-size'
      );

      expect(result.success).toBe(true);
      expect(result.chunksEmbedded).toBeGreaterThan(0);
    });

    it('ควร embed สำเร็จเมื่อไม่มี documentDate', async () => {
      mockAiPromptsService.resolveActive.mockResolvedValueOnce({
        resolvedPrompt: 'prompt',
        versionNumber: 1,
      });
      mockOllamaService.generate.mockResolvedValueOnce(
        '<chunk topic="test">ข้อความทดสอบไม่มี documentDate ความยาวเพียงพอ</chunk>'
      );
      mockOcrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });

      const result = await service.embedDocument(
        'proj-uuid',
        'doc-uuid',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Subject',
        undefined,
        'ข้อความทดสอบไม่มี documentDate ความยาวเพียงพอ'
      );

      expect(result.success).toBe(true);
    });
  });
});
