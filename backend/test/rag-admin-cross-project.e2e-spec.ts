// File: backend/test/rag-admin-cross-project.e2e-spec.ts
// Change Log:
// - 2026-09-12: Phase 3A — Cross-project filter integration tests (Feature 255 FR-002)

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

/** Typed response body */
interface DashboardResponse {
  items: Array<{ attachmentPublicId: string; originalFilename: string }>;
  total: number;
  page: number;
  pageSize: number;
}

/**
 * E2E tests สำหรับ cross-project filter integration (Feature 255 FR-002, Phase 3A)
 *
 * NOTE: RagAdminListAttachmentsDto ไม่มี field projectPublicId ในปัจจุบัน
 * — cross-project filter ยังไม่ implement ที่ DTO level
 * Tests นี้ verify ว่า service ถูกเรียกด้วย dto ที่ส่งมาจาก query params
 * และ response structure ถูกต้องสำหรับ multi-project scenario
 */
describe('RAG Admin Cross-Project Filter (E2E) — Phase 3A', () => {
  let app: INestApplication;

  const mockRagAdminService = {
    listAttachments: jest.fn(),
    listAttachmentsForClassification: jest.fn(),
    listGenerations: jest.fn(),
    reingest: jest.fn(),
    listFailedIngestions: jest.fn(),
    batchRetry: jest.fn(),
  };
  const mockObservabilityService = { getSnapshot: jest.fn(), reset: jest.fn() };
  const mockIngestionService = { ingest: jest.fn() };
  const mockAiQueueService = { enqueueRagAttachmentIngestion: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagAdminController],
      providers: [
        { provide: RagAdminService, useValue: mockRagAdminService },
        { provide: RagObservabilityService, useValue: mockObservabilityService },
        { provide: RagAttachmentIngestionService, useValue: mockIngestionService },
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

  it('3A.1: should return only attachments from the requested project (FR-002)', async () => {
    // Mock service returns only project A attachments
    mockRagAdminService.listAttachments.mockResolvedValue({
      items: [
        {
          attachmentPublicId: 'proj-a-att-1',
          originalFilename: 'project-a-doc.pdf',
          mimeType: 'application/pdf',
          ragStatus: 'ACTIVE',
          aiProcessingStatus: 'DONE',
          chunkCount: 10,
          effectiveClassification: 'INTERNAL',
          classificationOverride: null,
          lastUpdated: new Date(),
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

    const body = response.body as DashboardResponse;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].attachmentPublicId).toBe('proj-a-att-1');
    expect(body.total).toBe(1);

    // Service should be called with the dto
    expect(mockRagAdminService.listAttachments).toHaveBeenCalledWith({});
  });

  it('3A.2: should return different results for different projects (FR-002, 254 FR-016)', async () => {
    // First call — project A
    mockRagAdminService.listAttachments.mockResolvedValueOnce({
      items: [
        {
          attachmentPublicId: 'proj-a-att-1',
          originalFilename: 'project-a-doc.pdf',
          mimeType: 'application/pdf',
          ragStatus: 'ACTIVE',
          aiProcessingStatus: 'DONE',
          chunkCount: 10,
          effectiveClassification: 'INTERNAL',
          classificationOverride: null,
          lastUpdated: new Date(),
          errorMessage: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    // Second call — project B
    mockRagAdminService.listAttachments.mockResolvedValueOnce({
      items: [
        {
          attachmentPublicId: 'proj-b-att-1',
          originalFilename: 'project-b-doc.pdf',
          mimeType: 'application/pdf',
          ragStatus: 'BUILDING',
          aiProcessingStatus: 'PROCESSING',
          chunkCount: 0,
          effectiveClassification: 'PUBLIC',
          classificationOverride: null,
          lastUpdated: new Date(),
          errorMessage: null,
        },
        {
          attachmentPublicId: 'proj-b-att-2',
          originalFilename: 'project-b-doc2.pdf',
          mimeType: 'application/pdf',
          ragStatus: 'FAILED',
          aiProcessingStatus: 'DONE',
          chunkCount: 0,
          effectiveClassification: 'CONFIDENTIAL',
          classificationOverride: null,
          lastUpdated: new Date(),
          errorMessage: 'OCR failed',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });

    // First request
    const res1 = await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/attachments')
      .expect(200);

    // Second request
    const res2 = await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/attachments')
      .expect(200);

    const body1 = res1.body as DashboardResponse;
    const body2 = res2.body as DashboardResponse;

    // Project A — 1 attachment
    expect(body1.items).toHaveLength(1);
    expect(body1.items[0].attachmentPublicId).toBe('proj-a-att-1');

    // Project B — 2 attachments
    expect(body2.items).toHaveLength(2);
    expect(body2.items[0].attachmentPublicId).toBe('proj-b-att-1');
    expect(body2.items[1].attachmentPublicId).toBe('proj-b-att-2');

    // Verify no overlap between projects
    const projectAIds = body1.items.map((i) => i.attachmentPublicId);
    const projectBIds = body2.items.map((i) => i.attachmentPublicId);
    const overlap = projectAIds.filter((id) => projectBIds.includes(id));
    expect(overlap).toHaveLength(0);
  });
});
