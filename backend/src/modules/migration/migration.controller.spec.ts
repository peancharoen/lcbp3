// File: backend/src/modules/migration/migration.controller.spec.ts
// Change Log:
// - 2026-08-06: Initial creation
// - 2026-08-07: Added tests for resolve-batch, trigger-rag-batch, review-thresholds endpoints

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';
import { MetadataResolutionService } from './services/metadata-resolution.service';
import { ReviewThresholdService } from './services/review-threshold.service';
import { RagBatchService } from './services/rag-batch.service';
import { UserService } from '../user/user.service';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { User } from '../user/entities/user.entity';

describe('MigrationController', () => {
  let controller: MigrationController;
  let service: MigrationService;
  let metadataResolutionService: jest.Mocked<MetadataResolutionService>;
  let reviewThresholdService: jest.Mocked<ReviewThresholdService>;
  let ragBatchService: jest.Mocked<RagBatchService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MigrationController],
      providers: [
        Reflector,
        {
          provide: MigrationService,
          useValue: {
            importCorrespondence: jest
              .fn()
              .mockResolvedValue({ message: 'Success' }),
          },
        },
        {
          provide: MetadataResolutionService,
          useValue: { resolveBatch: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: ReviewThresholdService,
          useValue: { getThresholds: jest.fn(), updateThresholds: jest.fn() },
        },
        {
          provide: RagBatchService,
          useValue: { triggerRagBatch: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: UserService,
          useValue: { getUserPermissions: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    controller = module.get<MigrationController>(MigrationController);
    service = module.get<MigrationService>(MigrationService);
    metadataResolutionService = module.get(MetadataResolutionService);
    reviewThresholdService = module.get(ReviewThresholdService);
    ragBatchService = module.get(RagBatchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('importCorrespondence', () => {
    it('should call importCorrespondence on service', async () => {
      const dto: ImportCorrespondenceDto = {
        documentNumber: 'DOC-001',
        subject: 'Legacy Record',
        category: 'Correspondence',
        sourceFilePath: '/staging_ai/test.pdf',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'batch1',
        projectId: 1,
      };

      const idempotencyKey = 'key123';
      const user: User = {
        user_id: 5,
        username: 'testuser',
        password: 'hashedpassword',
        email: 'test@example.com',
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        failedAttempts: 0,
        primaryOrganizationPublicId: undefined,
        generatePublicId: jest.fn(),
      };

      const result = await controller.importCorrespondence(
        dto,
        idempotencyKey,
        user
      );
      expect(result).toEqual({ message: 'Success' });
      expect(service.importCorrespondence).toHaveBeenCalledWith(
        dto,
        idempotencyKey,
        5
      );
    });
  });

  describe('POST /resolve-batch (FR-017, FR-020)', () => {
    it('calls metadataResolutionService.resolveBatch with batchId', async () => {
      const mockResult = {
        batchId: 'batch-001',
        total: 5,
        succeeded: 3,
        skipped: 0,
        failed: 2,
        tagsCreated: 4,
        tagsLinked: 4,
        startedAt: new Date(),
        completedAt: new Date(),
        failures: [],
      };
      metadataResolutionService.resolveBatch.mockResolvedValue(mockResult);

      const result = await controller.resolveBatch(
        { batchId: 'batch-001' },
        'idem-key-001'
      );

      expect(metadataResolutionService.resolveBatch).toHaveBeenCalledWith(
        'batch-001'
      );
      expect(result).toEqual(mockResult);
    });

    it('calls resolveBatch with undefined when no batchId', async () => {
      metadataResolutionService.resolveBatch.mockResolvedValue({
        batchId: null,
        total: 0,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        tagsCreated: 0,
        tagsLinked: 0,
        startedAt: new Date(),
        completedAt: new Date(),
        failures: [],
      });

      await controller.resolveBatch({}, 'idem-key-002');

      expect(metadataResolutionService.resolveBatch).toHaveBeenCalledWith(
        undefined
      );
    });

    it('returns 400 error when Idempotency-Key is missing', async () => {
      const result = await controller.resolveBatch({ batchId: 'b1' });

      expect(result).toEqual({
        error: 'Idempotency-Key header is required (FR-029)',
        statusCode: 400,
      });
      expect(metadataResolutionService.resolveBatch).not.toHaveBeenCalled();
    });
  });

  describe('GET /review-thresholds (FR-010a)', () => {
    it('calls reviewThresholdService.getThresholds', async () => {
      const mockThresholds = { maxMismatchFields: 3, minConfidence: 0.7 };
      reviewThresholdService.getThresholds.mockResolvedValue(mockThresholds);

      const result = await controller.getReviewThresholds();

      expect(reviewThresholdService.getThresholds).toHaveBeenCalled();
      expect(result).toEqual(mockThresholds);
    });
  });

  describe('PATCH /review-thresholds (FR-010d)', () => {
    it('calls reviewThresholdService.updateThresholds with values and user_id', async () => {
      const mockResult = { maxMismatchFields: 5, minConfidence: 0.8 };
      reviewThresholdService.updateThresholds.mockResolvedValue(mockResult);

      const user: User = {
        user_id: 42,
        username: 'admin',
        password: 'hashed',
        email: 'admin@test.com',
        publicId: 'uuid-admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        failedAttempts: 0,
        primaryOrganizationPublicId: undefined,
        generatePublicId: jest.fn(),
      };

      const result = await controller.updateReviewThresholds(
        { maxMismatchFields: 5, minConfidence: 0.8 },
        'idem-key-003',
        user
      );

      expect(reviewThresholdService.updateThresholds).toHaveBeenCalledWith(
        { maxMismatchFields: 5, minConfidence: 0.8 },
        42
      );
      expect(result).toEqual(mockResult);
    });

    it('uses user_id 0 when user is undefined', async () => {
      reviewThresholdService.updateThresholds.mockResolvedValue({
        maxMismatchFields: 3,
        minConfidence: 0.7,
      });

      await controller.updateReviewThresholds(
        { maxMismatchFields: 3 },
        'idem-key-004',
        undefined
      );

      expect(reviewThresholdService.updateThresholds).toHaveBeenCalledWith(
        { maxMismatchFields: 3, minConfidence: undefined },
        0
      );
    });

    it('returns 400 error when Idempotency-Key is missing', async () => {
      const result = await controller.updateReviewThresholds(
        { maxMismatchFields: 5 },
        undefined
      );

      expect(result).toEqual({
        error: 'Idempotency-Key header is required',
        statusCode: 400,
      });
      expect(reviewThresholdService.updateThresholds).not.toHaveBeenCalled();
    });
  });

  describe('POST /trigger-rag-batch (FR-026b)', () => {
    it('calls ragBatchService.triggerRagBatch with batchId', async () => {
      const mockResult = {
        batchId: 'batch-rag-001',
        total: 10,
        enqueued: 8,
        skipped: 2,
        failed: 0,
        enqueuedAt: new Date(),
        skipBreakdown: {
          noTextLayer: 1,
          emptyOcrText: 1,
          alreadyEmbedded: 0,
        },
      };
      ragBatchService.triggerRagBatch.mockResolvedValue(mockResult);

      const result = await controller.triggerRagBatch(
        { batchId: 'batch-rag-001' },
        'idem-key-rag-001'
      );

      expect(ragBatchService.triggerRagBatch).toHaveBeenCalledWith(
        'batch-rag-001'
      );
      expect(result).toEqual(mockResult);
    });

    it('calls triggerRagBatch with undefined when no batchId', async () => {
      ragBatchService.triggerRagBatch.mockResolvedValue({
        batchId: null,
        total: 0,
        enqueued: 0,
        skipped: 0,
        failed: 0,
        enqueuedAt: new Date(),
        skipBreakdown: {
          noTextLayer: 0,
          emptyOcrText: 0,
          alreadyEmbedded: 0,
        },
      });

      await controller.triggerRagBatch({}, 'idem-key-rag-002');

      expect(ragBatchService.triggerRagBatch).toHaveBeenCalledWith(undefined);
    });

    it('returns 400 error when Idempotency-Key is missing', async () => {
      const result = await controller.triggerRagBatch({ batchId: 'b1' });

      expect(result).toEqual({
        error: 'Idempotency-Key header is required (FR-029)',
        statusCode: 400,
      });
      expect(ragBatchService.triggerRagBatch).not.toHaveBeenCalled();
    });
  });
});
