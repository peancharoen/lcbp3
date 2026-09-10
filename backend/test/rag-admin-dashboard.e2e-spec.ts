// File: backend/test/rag-admin-dashboard.e2e-spec.ts
// Change Log:
// - 2026-09-10: T063 — E2E test สำหรับ US1 status dashboard flow (Feature 255)

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
  createMockAttachment,
  createMockGeneration,
} from './fixtures/rag-admin-fixtures';

/** Typed response bodies */
interface DashboardResponse {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * E2E tests สำหรับ US1 status dashboard flow (Feature 255, T063)
 * ทดสอบผ่าน NestJS DI + supertest โดยใช้ mock services (ไม่ต้อง Qdrant/Redis/OCR sidecar จริง — Q27)
 */
describe('RAG Admin Dashboard flow (E2E) — Feature 255 T063', () => {
  let app: INestApplication;

  const mockRagAdminService = {
    listAttachments: jest.fn(),
    listAttachmentsForClassification: jest.fn(),
    listGenerations: jest.fn(),
    reingest: jest.fn(),
    listFailedIngestions: jest.fn(),
    batchRetry: jest.fn(),
  };
  const mockObservabilityService = {
    getSnapshot: jest.fn(),
    reset: jest.fn(),
  };
  const mockIngestionService = {
    ingest: jest.fn(),
  };
  const mockAiQueueService = {
    enqueueRagAttachmentIngestion: jest.fn(),
  };

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

  it('GET /ai/admin/rag/attachments — should return paginated attachments list', async () => {
    const mockAttachment = createMockAttachment();
    const mockGeneration = createMockGeneration({
      attachmentUuid: mockAttachment.publicId,
      status: 'ACTIVE',
    });

    mockRagAdminService.listAttachments.mockResolvedValue({
      items: [
        {
          attachmentPublicId: mockAttachment.publicId,
          originalFilename: mockAttachment.originalFilename,
          mimeType: mockAttachment.mimeType,
          ragStatus: 'ACTIVE',
          aiProcessingStatus: 'DONE',
          chunkCount: 42,
          effectiveClassification: 'PUBLIC',
          classificationOverride: null,
          lastUpdated: mockGeneration.createdAt,
          errorMessage: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/attachments')
      .expect(200);

    expect((response.body as DashboardResponse).items).toHaveLength(1);
    expect((response.body as DashboardResponse).items[0].ragStatus).toBe(
      'ACTIVE'
    );
    expect((response.body as DashboardResponse).page).toBe(1);
    expect((response.body as DashboardResponse).pageSize).toBe(20);
  });

  it('GET /ai/admin/rag/attachments — should accept pageSize enum [10,20,50]', async () => {
    mockRagAdminService.listAttachments.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/attachments?pageSize=50')
      .expect(200);

    expect((response.body as DashboardResponse).pageSize).toBe(50);
  });

  it('GET /ai/admin/rag/attachments — should reject invalid pageSize', async () => {
    await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/attachments?pageSize=100')
      .expect(400);
  });

  it('GET /ai/admin/rag/attachments — should accept status filter', async () => {
    mockRagAdminService.listAttachments.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/attachments?status=FAILED')
      .expect(200);

    expect(mockRagAdminService.listAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED' })
    );
  });

  it('GET /ai/admin/rag/attachments — should accept NOT_STARTED status filter (Q9)', async () => {
    mockRagAdminService.listAttachments.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/attachments?status=NOT_STARTED')
      .expect(200);

    expect(mockRagAdminService.listAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'NOT_STARTED' })
    );
  });
});
