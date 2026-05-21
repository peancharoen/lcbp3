// File: src/modules/ai/processors/ai-batch.processor.spec.ts
// Change Log
// - 2026-05-21: สร้าง Unit Test สำหรับ AiBatchProcessor ครอบคลุม embed-document และ sandbox-rag (T032).
// - 2026-05-21: เพิ่มการทดสอบ sandbox-extract พร้อม mock OcrService, OllamaService และ Redis (T039).
// - 2026-05-21: แก้ไข ESLint unexpected any และ unsafe member access โดยกำหนด type ให้ redis เป็น Record<string, jest.Mock>

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { AiBatchProcessor, AiBatchJobData } from './ai-batch.processor';
import { EmbeddingService } from '../services/embedding.service';
import { AiRagService } from '../ai-rag.service';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { OcrService } from '../services/ocr.service';
import { OllamaService } from '../services/ollama.service';

describe('AiBatchProcessor', () => {
  let processor: AiBatchProcessor;
  let embeddingService: jest.Mocked<EmbeddingService>;
  let ragService: jest.Mocked<AiRagService>;
  let ocrService: jest.Mocked<OcrService>;
  let ollamaService: jest.Mocked<OllamaService>;
  let redis: Record<string, jest.Mock>;
  let attachmentRepo: jest.Mocked<Repository<Attachment>>;
  const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';
  const mockEmbeddingService = {
    embedDocument: jest
      .fn()
      .mockResolvedValue({ success: true, chunksEmbedded: 5 }),
  };
  const mockRagService = {
    processQuery: jest.fn().mockResolvedValue(undefined),
  };
  const mockOcrService = {
    detectAndExtract: jest
      .fn()
      .mockResolvedValue({ text: 'OCR text LCBP3-CIV-001 Civil' }),
  };
  const mockOllamaService = {
    generate: jest.fn().mockResolvedValue(
      JSON.stringify({
        documentNumber: 'LCBP3-CIV-001',
        subject: 'Foundation Inspection Report',
        discipline: 'Civil',
        date: '2026-05-20',
        confidence: 0.95,
      })
    ),
  };
  const mockRedis = {
    setex: jest.fn().mockResolvedValue('OK'),
  };
  const mockAttachmentRepo = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiBatchProcessor,
        { provide: EmbeddingService, useValue: mockEmbeddingService },
        { provide: AiRagService, useValue: mockRagService },
        { provide: OcrService, useValue: mockOcrService },
        { provide: OllamaService, useValue: mockOllamaService },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockAttachmentRepo,
        },
      ],
    }).compile();
    processor = module.get<AiBatchProcessor>(AiBatchProcessor);
    embeddingService = module.get(EmbeddingService);
    ragService = module.get(AiRagService);
    ocrService = module.get(OcrService);
    ollamaService = module.get(OllamaService);
    redis = module.get(DEFAULT_REDIS_TOKEN);
    attachmentRepo = module.get(getRepositoryToken(Attachment));
    jest.clearAllMocks();
  });
  it('ควรสามารถเรียก process embed-document และอัปเดตสถานะใน database', async () => {
    const job = {
      id: 'job-embed',
      data: {
        jobType: 'embed-document',
        documentPublicId: 'doc-uuid-123',
        projectPublicId: 'proj-uuid-456',
        payload: { pdfPath: '/files/test.pdf' },
        idempotencyKey: 'idem-123',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(embeddingService.embedDocument).toHaveBeenCalledTimes(1);
    expect(attachmentRepo.update).toHaveBeenCalledWith(
      { publicId: 'doc-uuid-123' },
      { aiProcessingStatus: 'PROCESSING' }
    );
    expect(attachmentRepo.update).toHaveBeenCalledWith(
      { publicId: 'doc-uuid-123' },
      { aiProcessingStatus: 'DONE' }
    );
  });
  it('ควรประมวลผล sandbox-rag โดยการเรียก ragService.processQuery และข้ามการอัปเดต database', async () => {
    const job = {
      id: 'job-sandbox',
      data: {
        jobType: 'sandbox-rag',
        documentPublicId: 'idem-sandbox-123',
        projectPublicId: 'proj-uuid-456',
        payload: {
          query: 'ทดสอบคำถาม sandbox RAG',
          userPublicId: 'user-uuid-789',
        },
        idempotencyKey: 'idem-sandbox-123',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(ragService.processQuery).toHaveBeenCalledTimes(1);
    expect(ragService.processQuery).toHaveBeenCalledWith(
      'idem-sandbox-123',
      'ทดสอบคำถาม sandbox RAG',
      'proj-uuid-456',
      'user-uuid-789',
      expect.any(AbortSignal)
    );
    expect(attachmentRepo.update).not.toHaveBeenCalled();
  });
  it('ควรประมวลผล sandbox-extract โดยใช้ OcrService, OllamaService และเก็บค่าลง Redis', async () => {
    const job = {
      id: 'job-extract',
      data: {
        jobType: 'sandbox-extract',
        documentPublicId: 'idem-extract-123',
        projectPublicId: 'proj-uuid-456',
        payload: { pdfPath: '/files/test.pdf' },
        idempotencyKey: 'idem-extract-123',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(ocrService.detectAndExtract).toHaveBeenCalledWith({
      pdfPath: '/files/test.pdf',
    });
    expect(ollamaService.generate).toHaveBeenCalledTimes(1);
    expect(redis.setex).toHaveBeenCalledTimes(2);
    expect(redis.setex).toHaveBeenLastCalledWith(
      'ai:rag:result:idem-extract-123',
      3600,
      expect.stringContaining('completed')
    );
  });
});
