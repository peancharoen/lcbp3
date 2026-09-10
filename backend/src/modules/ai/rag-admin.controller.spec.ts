// File: backend/src/modules/ai/rag-admin.controller.spec.ts
// Change Log:
// - 2026-09-10: T019-T020 — สร้าง unit tests สำหรับ RagAdminController (Feature 255)

import { Test, TestingModule } from '@nestjs/testing';
import { RagAdminController } from './rag-admin.controller';
import { RagAdminService } from './services/rag-admin.service';
import { RagObservabilityService } from './services/rag-observability.service';
import { RagAttachmentIngestionService } from './services/rag-attachment-ingestion.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { AiEnabledGuard } from './guards/ai-enabled.guard';
import { ValidationException } from '../../common/exceptions';
import { RagAdminPageSize, RagAdminStatusFilter } from './dto/rag-admin.dto';

type MockedService = Record<string, jest.Mock>;

function createMockService(methods: string[]): MockedService {
  const mock: MockedService = {};
  for (const m of methods) {
    mock[m] = jest.fn();
  }
  return mock;
}

describe('RagAdminController', () => {
  let controller: RagAdminController;
  let mockRagAdminService: MockedService;
  let mockObservabilityService: MockedService;
  let mockIngestionService: MockedService;

  beforeEach(async () => {
    mockRagAdminService = createMockService([
      'listAttachments',
      'listAttachmentsForClassification',
      'listGenerations',
      'reingest',
      'listFailedIngestions',
      'batchRetry',
    ]);
    mockObservabilityService = createMockService(['getSnapshot', 'reset']);
    mockIngestionService = createMockService(['ingest']);

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
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AiEnabledGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RagAdminController>(RagAdminController);
  });

  describe('GET /ai/admin/rag/attachments (T019)', () => {
    it('should call listAttachments with default pagination', async () => {
      mockRagAdminService.listAttachments.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      const result = await controller.listAttachments({});

      expect(mockRagAdminService.listAttachments).toHaveBeenCalledWith({});
      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    });

    it('should pass projectPublicId and status filters', async () => {
      mockRagAdminService.listAttachments.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      await controller.listAttachments({
        projectPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        status: RagAdminStatusFilter.ACTIVE,
        page: 2,
        pageSize: RagAdminPageSize.FIFTY,
      });

      expect(mockRagAdminService.listAttachments).toHaveBeenCalledWith({
        projectPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        status: RagAdminStatusFilter.ACTIVE,
        page: 2,
        pageSize: RagAdminPageSize.FIFTY,
      });
    });

    it('should accept NOT_STARTED status filter (computed — Q9)', async () => {
      mockRagAdminService.listAttachments.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      await controller.listAttachments({
        status: RagAdminStatusFilter.NOT_STARTED,
      });

      expect(mockRagAdminService.listAttachments).toHaveBeenCalledWith({
        status: RagAdminStatusFilter.NOT_STARTED,
      });
    });
  });

  describe('GET /ai/admin/rag/attachments/classification (T026)', () => {
    it('should call listAttachmentsForClassification', async () => {
      mockRagAdminService.listAttachmentsForClassification.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      const result = await controller.listAttachmentsForClassification({});

      expect(
        mockRagAdminService.listAttachmentsForClassification
      ).toHaveBeenCalledWith({});
      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe('GET /ai/admin/rag/attachments/:id/generations (T034)', () => {
    it('should call listGenerations with attachmentPublicId', async () => {
      mockRagAdminService.listGenerations.mockResolvedValue({
        attachmentPublicId: 'test-uuid',
        generations: [],
      });

      const result = await controller.listGenerations('test-uuid');

      expect(mockRagAdminService.listGenerations).toHaveBeenCalledWith(
        'test-uuid'
      );
      expect(result).toEqual({
        attachmentPublicId: 'test-uuid',
        generations: [],
      });
    });
  });

  describe('POST /ai/admin/rag/attachments/:id/reingest (T035)', () => {
    it('should throw ValidationException if Idempotency-Key missing', async () => {
      await expect(controller.reingest('test-uuid', undefined)).rejects.toThrow(
        ValidationException
      );
    });

    it('should throw ValidationException if Idempotency-Key is empty string', async () => {
      await expect(controller.reingest('test-uuid', '  ')).rejects.toThrow(
        ValidationException
      );
    });

    it('should call ragAdminService.reingest with valid Idempotency-Key', async () => {
      mockRagAdminService.reingest.mockResolvedValue({
        attachmentPublicId: 'test-uuid',
        status: 'BUILDING',
        jobId: 'job-123',
      });

      const result = await controller.reingest('test-uuid', 'key-123');

      expect(mockRagAdminService.reingest).toHaveBeenCalledWith('test-uuid');
      expect(result).toEqual({
        attachmentPublicId: 'test-uuid',
        status: 'BUILDING',
        jobId: 'job-123',
      });
    });
  });

  describe('GET /ai/admin/rag/metrics (T043)', () => {
    it('should delegate to observabilityService.getSnapshot()', () => {
      const mockSnapshot = { uptimeMs: 1000 };
      mockObservabilityService.getSnapshot.mockReturnValue(mockSnapshot);

      const result = controller.getMetrics();

      expect(mockObservabilityService.getSnapshot).toHaveBeenCalled();
      expect(result).toEqual(mockSnapshot);
    });
  });

  describe('POST /ai/admin/rag/metrics/reset (T044)', () => {
    it('should call observabilityService.reset() and return global scope', () => {
      const result = controller.resetMetrics();

      expect(mockObservabilityService.reset).toHaveBeenCalled();
      expect(result).toEqual({ reset: true, scope: 'global' });
    });
  });

  describe('GET /ai/admin/rag/failed-ingestions (T050)', () => {
    it('should call listFailedIngestions', async () => {
      mockRagAdminService.listFailedIngestions.mockResolvedValue({
        ragFailures: { items: [], total: 0, page: 1, pageSize: 20 },
        aiPipelineFailures: { items: [], total: 0 },
      });

      const result = await controller.listFailedIngestions({});

      expect(mockRagAdminService.listFailedIngestions).toHaveBeenCalledWith({});
      expect(result.ragFailures).toBeDefined();
      expect(result.aiPipelineFailures).toBeDefined();
    });
  });

  describe('POST /ai/admin/rag/failed-ingestions/retry (T051)', () => {
    it('should throw ValidationException if Idempotency-Key missing', async () => {
      await expect(
        controller.batchRetry({ attachmentPublicIds: ['test-uuid'] }, undefined)
      ).rejects.toThrow(ValidationException);
    });

    it('should call batchRetry with attachmentPublicIds', async () => {
      mockRagAdminService.batchRetry.mockResolvedValue({
        succeeded: [{ attachmentPublicId: 'test-uuid', jobId: 'job-1' }],
        failed: [],
        totalRequested: 1,
        totalSucceeded: 1,
        totalFailed: 0,
      });

      const result = await controller.batchRetry(
        { attachmentPublicIds: ['test-uuid'] },
        'key-123'
      );

      expect(mockRagAdminService.batchRetry).toHaveBeenCalledWith([
        'test-uuid',
      ]);
      expect(result.totalSucceeded).toBe(1);
    });
  });
});
