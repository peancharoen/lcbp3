// File: backend/test/rag-admin-retry.e2e-spec.ts
// Change Log:
// - 2026-09-10: T067 — E2E test สำหรับ US5 retry flow (Feature 255)

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RbacGuard } from '../src/common/guards/rbac.guard';
import { AiEnabledGuard } from '../src/modules/ai/guards/ai-enabled.guard';
import { Attachment } from '../src/common/file-storage/entities/attachment.entity';
import { AuditLog } from '../src/common/entities/audit-log.entity';
import { RagAttachmentGeneration } from '../src/modules/ai/entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../src/modules/ai/entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../src/modules/ai/entities/rag-attachment-page.entity';
import { RagAdminController } from '../src/modules/ai/rag-admin.controller';
import { RagAdminService } from '../src/modules/ai/services/rag-admin.service';
import { RagObservabilityService } from '../src/modules/ai/services/rag-observability.service';
import { RagAttachmentIngestionService } from '../src/modules/ai/services/rag-attachment-ingestion.service';
import { AiQueueService } from '../src/modules/ai/ai-queue.service';
import {
  createMockFailedIngestion,
  createMockAiPipelineFailure,
} from './fixtures/rag-admin-fixtures';

/** Typed response bodies */
interface FailedIngestionsResponse {
  ragFailures: { items: unknown[]; total: number; page: number };
  aiPipelineFailures: { items: unknown[]; total: number };
}
interface BatchRetryResponse {
  succeeded: unknown[];
  failed: unknown[];
  totalRequested: number;
  totalSucceeded: number;
  totalFailed: number;
}
import { v7 as uuidv7 } from 'uuid';

describe('RAG Admin Retry flow (E2E) — Feature 255 T067', () => {
  let app: INestApplication;

  const mockRagAdminService = {
    listFailedIngestions: jest.fn(),
    batchRetry: jest.fn(),
  };
  const mockObservabilityService = {};
  const mockIngestionService = {};
  const mockAiQueueService = {};

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagAdminController],
      providers: [
        { provide: RagAdminService, useValue: mockRagAdminService },
        {
          provide: RagObservabilityService,
          useValue: mockObservabilityService,
        },
        {
          provide: RagAttachmentIngestionService,
          useValue: mockIngestionService,
        },
        { provide: AiQueueService, useValue: mockAiQueueService },
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(Attachment), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentGeneration), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentChunk), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentPage), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AiEnabledGuard)
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

  it('GET /ai/admin/rag/failed-ingestions — should return 2 sections (Q31)', async () => {
    const ragFailure = createMockFailedIngestion();
    const aiFailure = createMockAiPipelineFailure();

    mockRagAdminService.listFailedIngestions.mockResolvedValue({
      ragFailures: {
        items: [ragFailure],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      aiPipelineFailures: {
        items: [aiFailure],
        total: 1,
      },
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/failed-ingestions')
      .expect(200);

    expect(
      (response.body as FailedIngestionsResponse).ragFailures
    ).toBeDefined();
    expect(
      (response.body as FailedIngestionsResponse).ragFailures.items
    ).toHaveLength(1);
    expect((response.body as FailedIngestionsResponse).ragFailures.total).toBe(
      1
    );
    expect(
      (response.body as FailedIngestionsResponse).aiPipelineFailures
    ).toBeDefined();
    expect(
      (response.body as FailedIngestionsResponse).aiPipelineFailures.items
    ).toHaveLength(1);
    expect(
      (response.body as FailedIngestionsResponse).aiPipelineFailures.total
    ).toBe(1);
  });

  it('GET /ai/admin/rag/failed-ingestions — ragFailures should be paginated', async () => {
    mockRagAdminService.listFailedIngestions.mockResolvedValue({
      ragFailures: { items: [], total: 0, page: 2, pageSize: 20 },
      aiPipelineFailures: { items: [], total: 0 },
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/failed-ingestions?page=2')
      .expect(200);

    expect((response.body as FailedIngestionsResponse).ragFailures.page).toBe(
      2
    );
  });

  it('POST /ai/admin/rag/failed-ingestions/retry — should require Idempotency-Key', async () => {
    await request(app.getHttpServer() as import('http').Server)
      .post('/ai/admin/rag/failed-ingestions/retry')
      .send({ attachmentPublicIds: [uuidv7()] })
      .expect(400);
  });

  it('POST /ai/admin/rag/failed-ingestions/retry — should return partial-success (Q17)', async () => {
    const id1 = uuidv7();
    const id2 = uuidv7();
    mockRagAdminService.batchRetry.mockResolvedValue({
      succeeded: [{ attachmentPublicId: id1, jobId: 'job-1' }],
      failed: [
        {
          attachmentPublicId: id2,
          reason: 'Latest generation status is ACTIVE',
        },
      ],
      totalRequested: 2,
      totalSucceeded: 1,
      totalFailed: 1,
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .post('/ai/admin/rag/failed-ingestions/retry')
      .set('Idempotency-Key', 'batch-key-123')
      .send({ attachmentPublicIds: [id1, id2] })
      .expect(200);

    expect((response.body as BatchRetryResponse).succeeded).toHaveLength(1);
    expect((response.body as BatchRetryResponse).failed).toHaveLength(1);
    expect((response.body as BatchRetryResponse).totalRequested).toBe(2);
    expect((response.body as BatchRetryResponse).totalSucceeded).toBe(1);
    expect((response.body as BatchRetryResponse).totalFailed).toBe(1);
  });

  it('POST /ai/admin/rag/failed-ingestions/retry — should reject > 50 items (Q17)', async () => {
    const ids = Array.from({ length: 51 }, () => uuidv7());

    await request(app.getHttpServer() as import('http').Server)
      .post('/ai/admin/rag/failed-ingestions/retry')
      .set('Idempotency-Key', 'batch-key-456')
      .send({ attachmentPublicIds: ids })
      .expect(400);
  });

  it('POST /ai/admin/rag/failed-ingestions/retry — should reject empty array', async () => {
    await request(app.getHttpServer() as import('http').Server)
      .post('/ai/admin/rag/failed-ingestions/retry')
      .set('Idempotency-Key', 'batch-key-789')
      .send({ attachmentPublicIds: [] })
      .expect(400);
  });

  // ==========================================================
  // Phase 3C: BullMQ Retry Flow Integration (ADR-008, Q35/Q36)
  // ==========================================================

  it('3C.1: POST retry with FAILED generation → service marks RETIRED + creates BUILDING + enqueues BullMQ job (Q35/Q36, ADR-008)', async () => {
    const attachmentPublicId = uuidv7();

    // Mock service: retry succeeds — FAILED→RETIRED, new BUILDING created, BullMQ job enqueued
    mockRagAdminService.batchRetry.mockResolvedValue({
      succeeded: [
        {
          attachmentPublicId,
          jobId: 'bullmq-job-123',
        },
      ],
      failed: [],
      totalRequested: 1,
      totalSucceeded: 1,
      totalFailed: 0,
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .post('/ai/admin/rag/failed-ingestions/retry')
      .set('Idempotency-Key', 'retry-key-3c1')
      .send({ attachmentPublicIds: [attachmentPublicId] })
      .expect(200);

    const body = response.body as BatchRetryResponse;
    expect(body.succeeded).toHaveLength(1);
    expect((body.succeeded[0] as { jobId: string }).jobId).toBe(
      'bullmq-job-123'
    );
    expect(body.totalSucceeded).toBe(1);
    expect(body.totalFailed).toBe(0);

    // Verify service was called with correct attachment IDs
    expect(mockRagAdminService.batchRetry).toHaveBeenCalledWith([
      attachmentPublicId,
    ]);
  });

  it('3C.2: POST retry with BUILDING generation → returns failed[] with status reason (Q17)', async () => {
    const attachmentPublicId = uuidv7();

    mockRagAdminService.batchRetry.mockResolvedValue({
      succeeded: [],
      failed: [
        {
          attachmentPublicId,
          reason:
            'Latest generation status is BUILDING, only FAILED can be retried',
        },
      ],
      totalRequested: 1,
      totalSucceeded: 0,
      totalFailed: 1,
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .post('/ai/admin/rag/failed-ingestions/retry')
      .set('Idempotency-Key', 'retry-key-3c2')
      .send({ attachmentPublicIds: [attachmentPublicId] })
      .expect(200);

    const body = response.body as BatchRetryResponse;
    expect(body.failed).toHaveLength(1);
    expect((body.failed[0] as { reason: string }).reason).toContain('BUILDING');
    expect(body.totalSucceeded).toBe(0);
  });

  it('3C.3: POST retry with 51 items → rejected by @ArrayMaxSize(50) validation (Q34)', async () => {
    const ids = Array.from({ length: 51 }, () => uuidv7());

    await request(app.getHttpServer() as import('http').Server)
      .post('/ai/admin/rag/failed-ingestions/retry')
      .set('Idempotency-Key', 'retry-key-3c3')
      .send({ attachmentPublicIds: ids })
      .expect(400);

    // Service should NOT be called for invalid input
    expect(mockRagAdminService.batchRetry).not.toHaveBeenCalled();
  });
});
