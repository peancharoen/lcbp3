// File: backend/test/rag-admin-classification.e2e-spec.ts
// Change Log:
// - 2026-09-10: T064 — E2E test สำหรับ US2 classification flow (Feature 255)

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
  createMockClassificationOverride,
} from './fixtures/rag-admin-fixtures';

/** Typed response body */
interface ClassificationResponse {
  items: Array<{
    effectiveClassification: string;
    classificationOverride: { reason: string } | null;
  }>;
}

describe('RAG Admin Classification flow (E2E) — Feature 255 T064', () => {
  let app: INestApplication;

  const mockRagAdminService = {
    listAttachmentsForClassification: jest.fn(),
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

  it('GET /ai/admin/rag/attachments/classification — should return classification list (Q43)', async () => {
    const mockAttachment = createMockAttachment({
      effectiveClassification: 'CONFIDENTIAL',
    });
    const mockOverride = createMockClassificationOverride({
      reason: 'Security review',
      overriddenBy: 'admin@example.com',
    });

    mockRagAdminService.listAttachmentsForClassification.mockResolvedValue({
      items: [
        {
          attachmentPublicId: mockAttachment.publicId,
          originalFilename: mockAttachment.originalFilename,
          effectiveClassification: 'CONFIDENTIAL',
          classificationOverride: mockOverride,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/attachments/classification')
      .expect(200);

    expect((response.body as ClassificationResponse).items).toHaveLength(1);
    expect(
      (response.body as ClassificationResponse).items[0].effectiveClassification
    ).toBe('CONFIDENTIAL');
    expect(
      (response.body as ClassificationResponse).items[0].classificationOverride
        .reason
    ).toBe('Security review');
  });

  it('GET /ai/admin/rag/attachments/classification — should show all attachments (Q42)', async () => {
    mockRagAdminService.listAttachmentsForClassification.mockResolvedValue({
      items: [
        {
          attachmentPublicId: 'uuid-1',
          originalFilename: 'with-override.pdf',
          effectiveClassification: 'INTERNAL',
          classificationOverride: {
            reason: 'Review',
            overriddenBy: 'admin',
            overriddenAt: new Date(),
          },
        },
        {
          attachmentPublicId: 'uuid-2',
          originalFilename: 'no-override.pdf',
          effectiveClassification: 'PUBLIC',
          classificationOverride: null,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/attachments/classification')
      .expect(200);

    expect((response.body as ClassificationResponse).items).toHaveLength(2);
    expect(
      (response.body as ClassificationResponse).items[0].classificationOverride
    ).not.toBeNull();
    expect(
      (response.body as ClassificationResponse).items[1].classificationOverride
    ).toBeNull();
  });
});
