// File: backend/tests/e2e/rag-attachment-api.e2e-spec.ts
// Change Log:
// - 2026-09-09: เพิ่ม E2E tests สำหรับ RAG Attachment API endpoints (Feature 254)

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RbacGuard } from '../../src/common/guards/rbac.guard';
import { Attachment } from '../../src/common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../../src/modules/ai/entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../../src/modules/ai/entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../../src/modules/ai/entities/rag-attachment-page.entity';
import { RagAttachmentController } from '../../src/modules/ai/rag-attachment.controller';
import { RagGenerationService } from '../../src/modules/ai/services/rag-generation.service';
import { RagRetrievalService } from '../../src/modules/ai/services/rag-retrieval.service';
import { RagGenerationLockService } from '../../src/modules/ai/services/rag-generation-lock.service';
import { RagErrorService } from '../../src/modules/ai/services/rag-error.service';
import { RagAttachmentIngestionService } from '../../src/modules/ai/services/rag-attachment-ingestion.service';
import { RagClassificationService } from '../../src/modules/ai/services/rag-classification.service';
import { AiQueueService } from '../../src/modules/ai/ai-queue.service';
import { OcrService } from '../../src/modules/ai/services/ocr.service';

/**
 * E2E tests สำหรับ RAG Attachment API
 * ทดสอบผ่าน NestJS DI + supertest โดยใช้ mock repositories
 * ครอบคลุม: ingest, status, query, classification override
 */
describe('RAG Attachment API (E2E)', () => {
  let app: INestApplication;

  const generationService = {
    createBuildingGeneration: jest.fn(),
    getStatus: jest.fn(),
    overrideClassification: jest.fn(),
  };
  const retrievalService = { retrieve: jest.fn() };
  const ocrService = { embedViaSidecar: jest.fn() };
  const aiQueueService = { enqueueRagAttachmentIngestion: jest.fn() };
  const ingestionService = {
    ingest: jest.fn().mockResolvedValue({
      generationUuid: 'gen-1',
      attachmentChecksumSnapshot: 'a'.repeat(64),
      status: 'BUILDING',
    }),
  };
  const classificationService = {
    overrideClassification: jest.fn().mockResolvedValue(undefined),
    getEffectiveClassification: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagAttachmentController],
      providers: [
        { provide: RagGenerationService, useValue: generationService },
        { provide: RagRetrievalService, useValue: retrievalService },
        { provide: OcrService, useValue: ocrService },
        { provide: AiQueueService, useValue: aiQueueService },
        { provide: RagAttachmentIngestionService, useValue: ingestionService },
        { provide: RagClassificationService, useValue: classificationService },
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
    it('returns 400 when Idempotency-Key header is missing', async () => {
      await request(app.getHttpServer() as () => void)
        .post(`/ai/rag/attachments/${ATTACHMENT_ID}/ingest`)
        .send({ force: false })
        .expect(400);
    });

    it('returns 202 and enqueues ingestion with Idempotency-Key', async () => {
      ingestionService.ingest.mockResolvedValue({
        generationUuid: 'gen-1',
        attachmentChecksumSnapshot: 'a'.repeat(64),
        status: 'BUILDING',
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
      expect(body).not.toHaveProperty('generationUuid');
    });

    it('returns 202 when force=true creates new generation', async () => {
      ingestionService.ingest.mockResolvedValue({
        generationUuid: 'gen-2',
        attachmentChecksumSnapshot: 'b'.repeat(64),
        status: 'BUILDING',
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
    });
  });

  describe('GET /ai/rag/attachments/:attachmentPublicId/status', () => {
    it('returns ingestion status without generation UUID', async () => {
      generationService.getStatus.mockResolvedValue({
        attachmentPublicId: ATTACHMENT_ID,
        status: 'ACTIVE',
        chunkCount: 5,
        indexedAt: '2026-09-09T12:00:00.000Z',
      });

      const res = await request(app.getHttpServer() as () => void)
        .get(`/ai/rag/attachments/${ATTACHMENT_ID}/status`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body).toEqual({
        attachmentPublicId: ATTACHMENT_ID,
        status: 'ACTIVE',
        chunkCount: 5,
        indexedAt: '2026-09-09T12:00:00.000Z',
      });
      expect(body).not.toHaveProperty('generationUuid');
    });

    it('returns NOT_STARTED status when no generation exists', async () => {
      generationService.getStatus.mockResolvedValue({
        attachmentPublicId: ATTACHMENT_ID,
        status: 'NOT_STARTED',
        chunkCount: 0,
      });

      const res = await request(app.getHttpServer() as () => void)
        .get(`/ai/rag/attachments/${ATTACHMENT_ID}/status`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body['status']).toBe('NOT_STARTED');
      expect(body['chunkCount']).toBe(0);
    });
  });

  describe('POST /ai/rag/attachments/query', () => {
    it('returns 400 when projectPublicId is missing', async () => {
      await request(app.getHttpServer() as () => void)
        .post('/ai/rag/attachments/query')
        .send({ query: 'test' })
        .expect(400);
    });

    it('returns 400 when query is empty', async () => {
      await request(app.getHttpServer() as () => void)
        .post('/ai/rag/attachments/query')
        .send({
          projectPublicId: '019505a1-7c3e-7000-8000-abc123def456',
          query: '',
        })
        .expect(400);
    });

    it('returns citations for valid query', async () => {
      ocrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });
      retrievalService.retrieve.mockResolvedValue({
        citations: [
          {
            chunkPublicId: 'chunk-1',
            attachmentPublicId: ATTACHMENT_ID,
            ownerType: 'CORRESPONDENCE',
            ownerPublicId: 'corr-1',
            content: 'hello',
            score: 0.95,
          },
        ],
        totalFound: 1,
        skippedStale: 0,
      });

      const res = await request(app.getHttpServer() as () => void)
        .post('/ai/rag/attachments/query')
        .send({
          projectPublicId: '019505a1-7c3e-7000-8000-abc123def456',
          query: 'test query',
          topK: 5,
        })
        .expect(200);

      const body = res.body as Record<string, unknown>;
      const citations = body['citations'] as Array<Record<string, unknown>>;
      expect(citations).toHaveLength(1);
      expect(citations[0]['chunkPublicId']).toBe('chunk-1');
      expect(body['totalFound']).toBe(1);
    });
  });

  describe('PATCH /ai/rag/attachments/:attachmentPublicId/classification', () => {
    it('returns 400 when classification is missing', async () => {
      await request(app.getHttpServer() as () => void)
        .patch(`/ai/rag/attachments/${ATTACHMENT_ID}/classification`)
        .send({})
        .expect(400);
    });

    it('returns 400 when classification is invalid', async () => {
      await request(app.getHttpServer() as () => void)
        .patch(`/ai/rag/attachments/${ATTACHMENT_ID}/classification`)
        .send({ classification: 'INVALID' })
        .expect(400);
    });

    it('overrides classification when valid', async () => {
      classificationService.overrideClassification.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer() as () => void)
        .patch(`/ai/rag/attachments/${ATTACHMENT_ID}/classification`)
        .send({ classification: 'CONFIDENTIAL' })
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body).toEqual({
        attachmentPublicId: ATTACHMENT_ID,
        classification: 'CONFIDENTIAL',
      });
      expect(classificationService.overrideClassification).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentPublicId: ATTACHMENT_ID,
          newClassification: 'CONFIDENTIAL',
        })
      );
    });
  });
});
