// File: backend/test/rag-attachment-ingestion.e2e-spec.ts
// Change Log:
// - 2026-09-10: T032 — เพิ่ม E2E test สำหรับ committed Attachment → ACTIVE generation flow (Feature 254, Phase 3 US1)

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RbacGuard } from '../src/common/guards/rbac.guard';
import { Attachment } from '../src/common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../src/modules/ai/entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../src/modules/ai/entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../src/modules/ai/entities/rag-attachment-page.entity';
import { RagAttachmentController } from '../src/modules/ai/rag-attachment.controller';
import { RagGenerationService } from '../src/modules/ai/services/rag-generation.service';
import { RagAttachmentIngestionService } from '../src/modules/ai/services/rag-attachment-ingestion.service';
import { RagRetrievalService } from '../src/modules/ai/services/rag-retrieval.service';
import { RagGenerationLockService } from '../src/modules/ai/services/rag-generation-lock.service';
import { RagErrorService } from '../src/modules/ai/services/rag-error.service';
import { AiQueueService } from '../src/modules/ai/ai-queue.service';
import { OcrService } from '../src/modules/ai/services/ocr.service';

/**
 * E2E tests สำหรับ committed Attachment → ACTIVE generation flow (Feature 254, T032)
 * ทดสอบผ่าน NestJS DI + supertest โดยใช้ mock services (ไม่ต้อง Qdrant/Redis/OCR sidecar จริง)
 * ครอบคลุม MVP loop เต็มรูปแบบ:
 *   ingest request → BUILDING generation → processing → ACTIVE generation
 *
 * Mock: RagAttachmentIngestionService, RagRetrievalService, OcrService,
 *       AiQueueService, RagGenerationService (infra-dependent services)
 * Override: JwtAuthGuard, RbacGuard (pass-through)
 */
describe('RAG Attachment Ingestion flow (E2E) — Feature 254 T032', () => {
  let app: INestApplication;

  /** Mock ingestionService.ingest คืน object ที่มี status + attachmentChecksumSnapshot เหมือน entity */
  const ingestionService = {
    ingest: jest.fn(),
  };
  const generationService = {
    getStatus: jest.fn(),
    overrideClassification: jest.fn(),
  };
  const retrievalService = { retrieve: jest.fn() };
  const ocrService = { embedViaSidecar: jest.fn() };
  const aiQueueService = { enqueueRagAttachmentIngestion: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagAttachmentController],
      providers: [
        { provide: RagAttachmentIngestionService, useValue: ingestionService },
        { provide: RagGenerationService, useValue: generationService },
        { provide: RagRetrievalService, useValue: retrievalService },
        { provide: OcrService, useValue: ocrService },
        { provide: AiQueueService, useValue: aiQueueService },
        { provide: RagGenerationLockService, useValue: {} },
        { provide: RagErrorService, useValue: new RagErrorService() },
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(Attachment), useValue: {} },
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: {},
        },
        { provide: getRepositoryToken(RagAttachmentChunk), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentPage), useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const ATTACHMENT_ID = '019505a1-7c3e-7000-8000-abc123def456';

  describe('POST /ai/rag/attachments/:attachmentPublicId/ingest', () => {
    it('1. ส่ง Idempotency-Key ที่ถูกต้อง คืน 202 พร้อม { attachmentPublicId, status: BUILDING, jobId }', async () => {
      ingestionService.ingest.mockResolvedValue({
        status: 'BUILDING',
        attachmentChecksumSnapshot: 'a'.repeat(64),
      });
      aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue('job-1');

      const res = await request(app.getHttpServer() as () => void)
        .post(`/ai/rag/attachments/${ATTACHMENT_ID}/ingest`)
        .set('Idempotency-Key', 'req-1')
        .send({ force: false })
        .expect(202);

      const body = res.body as Record<string, unknown>;
      expect(body).toEqual({
        attachmentPublicId: ATTACHMENT_ID,
        status: 'BUILDING',
        jobId: 'job-1',
      });
      expect(ingestionService.ingest).toHaveBeenCalledWith(
        ATTACHMENT_ID,
        false
      );
      expect(aiQueueService.enqueueRagAttachmentIngestion).toHaveBeenCalledWith(
        {
          attachmentPublicId: ATTACHMENT_ID,
          attachmentChecksum: 'a'.repeat(64),

          force: false,
        }
      );
    });

    it('3. force=true คืน 202 พร้อม jobId ใหม่', async () => {
      ingestionService.ingest.mockResolvedValue({
        status: 'BUILDING',
        attachmentChecksumSnapshot: 'b'.repeat(64),
      });
      aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue('job-2');

      const res = await request(app.getHttpServer() as () => void)
        .post(`/ai/rag/attachments/${ATTACHMENT_ID}/ingest`)
        .set('Idempotency-Key', 'req-2')
        .send({ force: true })
        .expect(202);

      const body = res.body as Record<string, unknown>;
      expect(body['status']).toBe('BUILDING');
      expect(body['jobId']).toBe('job-2');
      expect(ingestionService.ingest).toHaveBeenCalledWith(ATTACHMENT_ID, true);
    });

    it('4. response ไม่เปิดเผย generationUuid', async () => {
      ingestionService.ingest.mockResolvedValue({
        generationUuid: 'gen-secret',
        status: 'BUILDING',
        attachmentChecksumSnapshot: 'c'.repeat(64),
      });
      aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue('job-3');

      const res = await request(app.getHttpServer() as () => void)
        .post(`/ai/rag/attachments/${ATTACHMENT_ID}/ingest`)
        .set('Idempotency-Key', 'req-3')
        .send({ force: false })
        .expect(202);

      const body = res.body as Record<string, unknown>;
      expect(body).not.toHaveProperty('generationUuid');
    });

    it('5. ไม่ส่ง Idempotency-Key คืน 400', async () => {
      await request(app.getHttpServer() as () => void)
        .post(`/ai/rag/attachments/${ATTACHMENT_ID}/ingest`)
        .send({ force: false })
        .expect(400);
    });
  });

  describe('GET /ai/rag/attachments/:attachmentPublicId/status', () => {
    it('2. คืน status ACTIVE พร้อม chunkCount หลัง processing เสร็จ', async () => {
      generationService.getStatus.mockResolvedValue({
        attachmentPublicId: ATTACHMENT_ID,
        status: 'ACTIVE',
        chunkCount: 12,
        indexedAt: '2026-09-10T12:00:00.000Z',
      });

      const res = await request(app.getHttpServer() as () => void)
        .get(`/ai/rag/attachments/${ATTACHMENT_ID}/status`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body).toEqual({
        attachmentPublicId: ATTACHMENT_ID,
        status: 'ACTIVE',
        chunkCount: 12,
        indexedAt: '2026-09-10T12:00:00.000Z',
      });
      expect(body).not.toHaveProperty('generationUuid');
      expect(generationService.getStatus).toHaveBeenCalledWith(ATTACHMENT_ID);
    });
  });
});
