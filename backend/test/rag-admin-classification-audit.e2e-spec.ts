// File: backend/test/rag-admin-classification-audit.e2e-spec.ts
// Change Log:
// - 2026-09-12: Phase 3B — Classification override audit trail E2E (Feature 255 FR-005, SC-006)

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
import { RagAttachmentController } from '../src/modules/ai/rag-attachment.controller';
import { RagAdminService } from '../src/modules/ai/services/rag-admin.service';
import { RagObservabilityService } from '../src/modules/ai/services/rag-observability.service';
import { RagAttachmentIngestionService } from '../src/modules/ai/services/rag-attachment-ingestion.service';
import { RagGenerationService } from '../src/modules/ai/services/rag-generation.service';
import { RagRetrievalService } from '../src/modules/ai/services/rag-retrieval.service';
import { OcrService } from '../src/modules/ai/services/ocr.service';
import { RagClassificationService } from '../src/modules/ai/services/rag-classification.service';
import { AiQueueService } from '../src/modules/ai/ai-queue.service';
import { v7 as uuidv7 } from 'uuid';

/** Typed response bodies */
interface ClassificationListResponse {
  items: Array<{
    attachmentPublicId: string;
    effectiveClassification: string;
    classificationOverride: {
      reason: string;
      overriddenBy: string;
      overriddenAt: string;
    } | null;
  }>;
  total: number;
}
interface OverrideResponse {
  attachmentPublicId: string;
  classification: string;
}

/**
 * E2E tests สำหรับ classification override audit trail (Feature 255 FR-005, SC-006, Phase 3B)
 * ทดสอบ flow: PATCH /ai/rag/attachments/:id/classification → GET /ai/admin/rag/attachments/classification
 */
describe('RAG Admin Classification Override Audit Trail (E2E) — Phase 3B', () => {
  let app: INestApplication;

  const mockRagAdminService = {
    listAttachmentsForClassification: jest.fn(),
  };
  const mockGenerationService = {
    overrideClassification: jest.fn(),
  };
  const mockClassificationService = {
    overrideClassification: jest.fn(),
  };
  const mockObservabilityService = {};
  const mockIngestionService = {};
  const mockRetrievalService = {};
  const mockOcrService = {};
  const mockAiQueueService = {};

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagAdminController, RagAttachmentController],
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
        { provide: RagGenerationService, useValue: mockGenerationService },
        { provide: RagRetrievalService, useValue: mockRetrievalService },
        { provide: OcrService, useValue: mockOcrService },
        {
          provide: RagClassificationService,
          useValue: mockClassificationService,
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

  it('3B.1: PATCH override → GET classification should show override info (FR-005, SC-006)', async () => {
    const attachmentPublicId = uuidv7();
    const overrideReason = 'Security review required';
    const overriddenBy = 'superadmin';

    // Step 1: PATCH override classification
    mockClassificationService.overrideClassification.mockResolvedValue(
      undefined
    );

    const patchResponse = await request(
      app.getHttpServer() as import('http').Server
    )
      .patch(`/ai/rag/attachments/${attachmentPublicId}/classification`)
      .send({ classification: 'CONFIDENTIAL', reason: overrideReason })
      .expect(200);

    const patchBody = patchResponse.body as OverrideResponse;
    expect(patchBody.attachmentPublicId).toBe(attachmentPublicId);
    expect(patchBody.classification).toBe('CONFIDENTIAL');

    // Verify classification service was called with correct params
    // NOTE: user is undefined because JwtAuthGuard is mocked without setting req.user
    expect(
      mockClassificationService.overrideClassification
    ).toHaveBeenCalledWith({
      attachmentPublicId,
      newClassification: 'CONFIDENTIAL',
      reason: overrideReason,
      user: undefined,
    });

    // Step 2: GET classification list should show the override
    const overriddenAt = new Date().toISOString();
    mockRagAdminService.listAttachmentsForClassification.mockResolvedValue({
      items: [
        {
          attachmentPublicId,
          originalFilename: 'classified-doc.pdf',
          effectiveClassification: 'CONFIDENTIAL',
          classificationOverride: {
            reason: overrideReason,
            overriddenBy,
            overriddenAt,
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const getResponse = await request(
      app.getHttpServer() as import('http').Server
    )
      .get('/ai/admin/rag/attachments/classification')
      .expect(200);

    const getBody = getResponse.body as ClassificationListResponse;
    expect(getBody.items).toHaveLength(1);
    expect(getBody.items[0].effectiveClassification).toBe('CONFIDENTIAL');
    expect(getBody.items[0].classificationOverride).not.toBeNull();
    expect(getBody.items[0].classificationOverride?.reason).toBe(
      overrideReason
    );
    expect(getBody.items[0].classificationOverride?.overriddenBy).toBe(
      overriddenBy
    );
    expect(getBody.items[0].classificationOverride?.overriddenAt).toBeDefined();
  });

  it('3B.2: GET classification should show null override for never-overridden attachment (FR-006)', async () => {
    mockRagAdminService.listAttachmentsForClassification.mockResolvedValue({
      items: [
        {
          attachmentPublicId: uuidv7(),
          originalFilename: 'never-overridden.pdf',
          effectiveClassification: 'INTERNAL',
          classificationOverride: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const response = await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/attachments/classification')
      .expect(200);

    const body = response.body as ClassificationListResponse;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].classificationOverride).toBeNull();
    expect(body.items[0].effectiveClassification).toBe('INTERNAL');
  });
});
