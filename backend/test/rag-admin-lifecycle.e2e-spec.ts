// File: backend/test/rag-admin-lifecycle.e2e-spec.ts
// Change Log:
// - 2026-09-10: T065 — E2E test สำหรับ US3 lifecycle flow (Feature 255)

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
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../src/common/exceptions';
import { createMockGeneration } from './fixtures/rag-admin-fixtures';

/** Typed response bodies */
interface LifecycleResponse {
  attachmentPublicId: string;
  generations: unknown[];
}
interface ReingestResponse {
  status: string;
  jobId: string;
}
import { v7 as uuidv7 } from 'uuid';

describe('RAG Admin Lifecycle flow (E2E) — Feature 255 T065', () => {
  let app: INestApplication;

  const mockRagAdminService = {
    listGenerations: jest.fn(),
    reingest: jest.fn(),
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

  it('GET /ai/admin/rag/attachments/:id/generations — should return lifecycle history (Q25)', async () => {
    const attachmentPublicId = uuidv7();
    const gen1 = createMockGeneration({
      attachmentUuid: attachmentPublicId,
      status: 'ACTIVE',
      activatedAt: new Date(),
    });
    const gen2 = createMockGeneration({
      attachmentUuid: attachmentPublicId,
      status: 'RETIRED',
      retiredAt: new Date(),
    });

    mockRagAdminService.listGenerations.mockResolvedValue({
      attachmentPublicId,
      generations: [
        {
          status: gen1.status,
          chunkCount: 42,
          createdAt: gen1.createdAt,
          activatedAt: gen1.activatedAt,
          retiredAt: null,
          failedAt: null,
          errorCode: null,
          errorMessage: null,
        },
        {
          status: gen2.status,
          chunkCount: 40,
          createdAt: gen2.createdAt,
          activatedAt: null,
          retiredAt: gen2.retiredAt,
          failedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      ],
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .get(`/ai/admin/rag/attachments/${attachmentPublicId}/generations`)
      .expect(200);

    expect((response.body as LifecycleResponse).attachmentPublicId).toBe(
      attachmentPublicId
    );
    expect((response.body as LifecycleResponse).generations).toHaveLength(2);
    // FR-014: internal generationUuid MUST NOT be exposed
    expect(
      (response.body as LifecycleResponse).generations[0]
    ).not.toHaveProperty('generationUuid');
    expect(
      (response.body as LifecycleResponse).generations[1]
    ).not.toHaveProperty('generationUuid');
  });

  it('GET /ai/admin/rag/attachments/:id/generations — should return 404 for non-existent attachment', async () => {
    const fakeId = uuidv7();
    mockRagAdminService.listGenerations.mockRejectedValue(
      new NotFoundException('Attachment', fakeId)
    );

    await request(app.getHttpServer() as import('http').Server)
      .get(`/ai/admin/rag/attachments/${fakeId}/generations`)
      .expect(404);
  });

  it('POST /ai/admin/rag/attachments/:id/reingest — should require Idempotency-Key', async () => {
    const attachmentPublicId = uuidv7();

    await request(app.getHttpServer() as import('http').Server)
      .post(`/ai/admin/rag/attachments/${attachmentPublicId}/reingest`)
      .expect(400);
  });

  it('POST /ai/admin/rag/attachments/:id/reingest — should return 202 with valid Idempotency-Key (Q12)', async () => {
    const attachmentPublicId = uuidv7();
    mockRagAdminService.reingest.mockResolvedValue({
      attachmentPublicId,
      status: 'BUILDING',
      jobId: 'job-123',
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .post(`/ai/admin/rag/attachments/${attachmentPublicId}/reingest`)
      .set('Idempotency-Key', 'test-key-123')
      .expect(202);

    expect((response.body as ReingestResponse).status).toBe('BUILDING');
    expect((response.body as ReingestResponse).jobId).toBe('job-123');
  });

  it('POST /ai/admin/rag/attachments/:id/reingest — should return 409 if BUILDING exists (Q13)', async () => {
    const attachmentPublicId = uuidv7();
    mockRagAdminService.reingest.mockRejectedValue(
      new ConflictException(
        'RAG_BUILDING_IN_PROGRESS',
        `Attachment ${attachmentPublicId} already has a BUILDING generation`,
        'กำลัง ingest อยู่ กรุณารอให้เสร็จก่อน',
        ['รอให้ ingestion ปัจจุบันเสร็จก่อน']
      )
    );

    await request(app.getHttpServer() as import('http').Server)
      .post(`/ai/admin/rag/attachments/${attachmentPublicId}/reingest`)
      .set('Idempotency-Key', 'test-key-456')
      .expect(409);
  });

  it('POST /ai/admin/rag/attachments/:id/reingest — should return 400 if no checksum (I2)', async () => {
    const attachmentPublicId = uuidv7();
    mockRagAdminService.reingest.mockRejectedValue(
      new ValidationException('Checksum is required for re-ingest', [])
    );

    await request(app.getHttpServer() as import('http').Server)
      .post(`/ai/admin/rag/attachments/${attachmentPublicId}/reingest`)
      .set('Idempotency-Key', 'test-key-789')
      .expect(400);
  });
});
