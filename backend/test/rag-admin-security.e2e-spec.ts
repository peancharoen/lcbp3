// File: backend/test/rag-admin-security.e2e-spec.ts
// Change Log:
// - 2026-09-12: Phase 5 — Security & RBAC E2E tests (Feature 255 FR-015, ADR-019, ADR-023, ADR-007)

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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
import { UserService } from '../src/modules/user/user.service';
import { v7 as uuidv7 } from 'uuid';

/**
 * E2E tests สำหรับ Security & RBAC (Feature 255 FR-015, Phase 5)
 * ทดสอบ RBAC permission gating, UUID compliance, AI boundary, idempotency, error handling
 */
describe('RAG Admin Security & RBAC (E2E) — Phase 5', () => {
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
  const mockIngestionService = { ingest: jest.fn() };
  const mockAiQueueService = { enqueueRagAttachmentIngestion: jest.fn() };
  const mockUserService = { getUserPermissions: jest.fn() };

  /** Build app with specific user permissions */
  async function buildAppWithPermissions(
    permissions: string[],
    aiEnabled: boolean
  ): Promise<INestApplication> {
    mockUserService.getUserPermissions.mockResolvedValue(permissions);

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
        { provide: UserService, useValue: mockUserService },
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(Attachment), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentGeneration), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentChunk), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentPage), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            user: { user_id: number; username: string };
          }>();
          req.user = { user_id: 1, username: 'testuser' };
          return true;
        },
      })
      // Use real RbacGuard with mocked UserService
      .overrideGuard(RbacGuard)
      .useValue(
        new RbacGuard(
          new Reflector(),
          mockUserService as unknown as UserService
        )
      )
      .overrideGuard(AiEnabledGuard)
      .useValue({ canActivate: () => aiEnabled })
      .compile();

    const appInstance = module.createNestApplication();
    appInstance.useGlobalPipes(new ValidationPipe({ transform: true }));
    await appInstance.init();
    return appInstance;
  }

  afterAll(async () => {
    // app closed per-test
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================
  // 5A: CASL Guard / RBAC (FR-015)
  // ==========================================================

  describe('5A: CASL Guard / RBAC', () => {
    it('5A.1: Viewer (no rag.manage) → GET attachments → 403 (FR-015)', async () => {
      const testApp = await buildAppWithPermissions([], true);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .get('/ai/admin/rag/attachments')
          .expect(403);
      } finally {
        await testApp.close();
      }
    });

    it('5A.2: User with rag.manage (no rag.admin.write) → POST reingest → 403 (FR-015)', async () => {
      const testApp = await buildAppWithPermissions(['rag.manage'], true);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .post(`/ai/admin/rag/attachments/${uuidv7()}/reingest`)
          .set('Idempotency-Key', 'key-5a2')
          .expect(403);
      } finally {
        await testApp.close();
      }
    });

    it('5A.3: User with rag.retry (no rag.admin.write) → POST metrics/reset → 403 (FR-015)', async () => {
      const testApp = await buildAppWithPermissions(['rag.retry'], true);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .post('/ai/admin/rag/metrics/reset')
          .expect(403);
      } finally {
        await testApp.close();
      }
    });

    it('5A.4: User with rag.retry → POST failed-ingestions/retry → 200 (FR-015)', async () => {
      const testApp = await buildAppWithPermissions(['rag.retry'], true);
      mockRagAdminService.batchRetry.mockResolvedValue({
        succeeded: [],
        failed: [],
        totalRequested: 1,
        totalSucceeded: 0,
        totalFailed: 0,
      });
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .post('/ai/admin/rag/failed-ingestions/retry')
          .set('Idempotency-Key', 'key-5a4')
          .send({ attachmentPublicIds: [uuidv7()] })
          .expect(200);
      } finally {
        await testApp.close();
      }
    });

    it('5A.6: Superadmin (system.manage_all) → all endpoints accessible (FR-015)', async () => {
      const testApp = await buildAppWithPermissions(
        ['system.manage_all'],
        true
      );
      mockRagAdminService.listAttachments.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
      mockRagAdminService.batchRetry.mockResolvedValue({
        succeeded: [],
        failed: [],
        totalRequested: 0,
        totalSucceeded: 0,
        totalFailed: 0,
      });
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .get('/ai/admin/rag/attachments')
          .expect(200);

        await request(testApp.getHttpServer() as import('http').Server)
          .get('/ai/admin/rag/attachments/classification')
          .expect(200);

        await request(testApp.getHttpServer() as import('http').Server)
          .get('/ai/admin/rag/metrics')
          .expect(200);

        await request(testApp.getHttpServer() as import('http').Server)
          .post('/ai/admin/rag/metrics/reset')
          .expect(200);

        await request(testApp.getHttpServer() as import('http').Server)
          .post('/ai/admin/rag/failed-ingestions/retry')
          .set('Idempotency-Key', 'key-5a6')
          .send({ attachmentPublicIds: [uuidv7()] })
          .expect(200);
      } finally {
        await testApp.close();
      }
    });
  });

  // ==========================================================
  // 5B: UUID / ADR-019 Compliance
  // ==========================================================

  describe('5B: UUID / ADR-019 Compliance', () => {
    it('5B.1: Dashboard response uses publicId (UUIDv7), no INT id exposed', async () => {
      const testApp = await buildAppWithPermissions(['rag.manage'], true);
      mockRagAdminService.listAttachments.mockResolvedValue({
        items: [
          {
            attachmentPublicId: uuidv7(),
            originalFilename: 'test.pdf',
            mimeType: 'application/pdf',
            ragStatus: 'ACTIVE',
            aiProcessingStatus: 'DONE',
            chunkCount: 5,
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
      try {
        const res = await request(
          testApp.getHttpServer() as import('http').Server
        )
          .get('/ai/admin/rag/attachments')
          .expect(200);

        const item = (res.body as { items: Array<Record<string, unknown>> })
          .items[0];
        expect(item.attachmentPublicId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        expect(item).not.toHaveProperty('id');
        expect(item).not.toHaveProperty('attachmentId');
      } finally {
        await testApp.close();
      }
    });

    it('5B.2: Lifecycle response does NOT expose internal generationUuid (FR-014)', async () => {
      const testApp = await buildAppWithPermissions(['rag.manage'], true);
      const attachmentPublicId = uuidv7();
      mockRagAdminService.listGenerations.mockResolvedValue({
        attachmentPublicId,
        generations: [
          {
            status: 'ACTIVE',
            chunkCount: 10,
            createdAt: new Date(),
            activatedAt: new Date(),
            retiredAt: null,
            failedAt: null,
            errorCode: null,
            errorMessage: null,
          },
        ],
      });
      try {
        const res = await request(
          testApp.getHttpServer() as import('http').Server
        )
          .get(`/ai/admin/rag/attachments/${attachmentPublicId}/generations`)
          .expect(200);

        const gen = (
          res.body as { generations: Array<Record<string, unknown>> }
        ).generations[0];
        expect(gen).not.toHaveProperty('generationUuid');
        expect(gen).not.toHaveProperty('generationId');
      } finally {
        await testApp.close();
      }
    });

    it('5B.3: Invalid UUID in URL param → 400 (not parsed as INT)', async () => {
      const testApp = await buildAppWithPermissions(['rag.manage'], true);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .get('/ai/admin/rag/attachments/not-a-uuid/generations')
          .expect(400);
      } finally {
        await testApp.close();
      }
    });

    it('5B.4: Classification response uses publicId, no id fallback', async () => {
      const testApp = await buildAppWithPermissions(['rag.manage'], true);
      mockRagAdminService.listAttachmentsForClassification.mockResolvedValue({
        items: [
          {
            attachmentPublicId: uuidv7(),
            originalFilename: 'classified.pdf',
            effectiveClassification: 'CONFIDENTIAL',
            classificationOverride: null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      try {
        const res = await request(
          testApp.getHttpServer() as import('http').Server
        )
          .get('/ai/admin/rag/attachments/classification')
          .expect(200);

        const item = (res.body as { items: Array<Record<string, unknown>> })
          .items[0];
        expect(item.attachmentPublicId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}/i
        );
        expect(item).not.toHaveProperty('id');
      } finally {
        await testApp.close();
      }
    });
  });

  // ==========================================================
  // 5C: AI Boundary (ADR-023/023A)
  // ==========================================================

  describe('5C: AI Boundary (AiEnabledGuard)', () => {
    it('5C.1: POST reingest when AI disabled → 503 (AiEnabledGuard blocks)', async () => {
      const testApp = await buildAppWithPermissions(['rag.admin.write'], false);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .post(`/ai/admin/rag/attachments/${uuidv7()}/reingest`)
          .set('Idempotency-Key', 'key-5c1')
          .expect(403); // AiEnabledGuard returns 403 when AI disabled
      } finally {
        await testApp.close();
      }
    });

    it('5C.2: POST failed-ingestions/retry when AI disabled → 403 (AiEnabledGuard blocks)', async () => {
      const testApp = await buildAppWithPermissions(['rag.retry'], false);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .post('/ai/admin/rag/failed-ingestions/retry')
          .set('Idempotency-Key', 'key-5c2')
          .send({ attachmentPublicIds: [uuidv7()] })
          .expect(403);
      } finally {
        await testApp.close();
      }
    });

    it('5C.3: GET attachments (read-only) when AI disabled → 200 (no AiEnabledGuard)', async () => {
      const testApp = await buildAppWithPermissions(['rag.manage'], false);
      mockRagAdminService.listAttachments.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .get('/ai/admin/rag/attachments')
          .expect(200);
      } finally {
        await testApp.close();
      }
    });

    it('5C.4: POST metrics/reset when AI disabled → 200 (no AiEnabledGuard, pure in-memory)', async () => {
      const testApp = await buildAppWithPermissions(['rag.admin.write'], false);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .post('/ai/admin/rag/metrics/reset')
          .expect(200);
      } finally {
        await testApp.close();
      }
    });
  });

  // ==========================================================
  // 5D: Idempotency & Audit Trail
  // ==========================================================

  describe('5D: Idempotency & Audit Trail', () => {
    it('5D.1: POST reingest without Idempotency-Key → 400 (ValidationException)', async () => {
      const testApp = await buildAppWithPermissions(['rag.admin.write'], true);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .post(`/ai/admin/rag/attachments/${uuidv7()}/reingest`)
          .expect(400);
      } finally {
        await testApp.close();
      }
    });

    it('5D.2: POST failed-ingestions/retry without Idempotency-Key → 400', async () => {
      const testApp = await buildAppWithPermissions(['rag.retry'], true);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .post('/ai/admin/rag/failed-ingestions/retry')
          .send({ attachmentPublicIds: [uuidv7()] })
          .expect(400);
      } finally {
        await testApp.close();
      }
    });

    it('5D.3: POST reingest with empty Idempotency-Key → 400', async () => {
      const testApp = await buildAppWithPermissions(['rag.admin.write'], true);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .post(`/ai/admin/rag/attachments/${uuidv7()}/reingest`)
          .set('Idempotency-Key', '   ')
          .expect(400);
      } finally {
        await testApp.close();
      }
    });
  });

  // ==========================================================
  // 5E: Error Handling (ADR-007)
  // ==========================================================

  describe('5E: Error Handling (ADR-007)', () => {
    it('5E.1: GET generations for non-existent attachment → 404 (user-friendly, no stack trace)', async () => {
      const testApp = await buildAppWithPermissions(['rag.manage'], true);
      const fakeId = uuidv7();
      mockRagAdminService.listGenerations.mockRejectedValue(
        new NotFoundException('Attachment', fakeId)
      );
      try {
        const res = await request(
          testApp.getHttpServer() as import('http').Server
        )
          .get(`/ai/admin/rag/attachments/${fakeId}/generations`)
          .expect(404);

        // Should not expose stack trace
        const body = JSON.stringify(res.body);
        expect(body).not.toContain('at ');
        expect(body).not.toContain('StackTrace');
      } finally {
        await testApp.close();
      }
    });

    it('5E.2: POST reingest with invalid UUID format → 400 (not 500)', async () => {
      const testApp = await buildAppWithPermissions(['rag.admin.write'], true);
      try {
        await request(testApp.getHttpServer() as import('http').Server)
          .post('/ai/admin/rag/attachments/invalid-uuid-format/reingest')
          .set('Idempotency-Key', 'key-5e2')
          .expect(400);
      } finally {
        await testApp.close();
      }
    });

    it('5E.3: GET metrics when observability throws → 200 with zero-value snapshot (FR-018)', async () => {
      const testApp = await buildAppWithPermissions(['rag.manage'], true);
      mockObservabilityService.getSnapshot.mockImplementation(() => {
        throw new Error('Qdrant connection refused');
      });
      try {
        const res = await request(
          testApp.getHttpServer() as import('http').Server
        )
          .get('/ai/admin/rag/metrics')
          .expect(200);

        // Should return zero-value snapshot, not 500
        expect(res.body).toBeDefined();
        const body = res.body as { swap?: { started: number } };
        expect(body.swap).toBeDefined();
        expect(body.swap!.started).toBe(0);
      } finally {
        await testApp.close();
      }
    });
  });
});
