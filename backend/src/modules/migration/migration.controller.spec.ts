// File: backend/src/modules/migration/migration.controller.spec.ts
// Change Log:
// - 2026-08-06: Initial creation
// - 2026-08-07: Added tests for resolve-batch, trigger-rag-batch, review-thresholds endpoints
// - 2026-08-17: Updated tests for ADR-016/019 compliance — Idempotency-Key
//   missing now throws ValidationException (not return 400 object), undefined
//   user now throws UnauthorizedException (not fallback to 0). Issue #3.

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';
import { MigrationReviewService } from './migration-review.service';
import { LegacyIngestionService } from './services/legacy-ingestion.service';

/** Minimal Multer file shape for testing (matches controller's MulterFile) */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}
import { MetadataResolutionService } from './services/metadata-resolution.service';
import { ReviewThresholdService } from './services/review-threshold.service';
import { RagBatchService } from './services/rag-batch.service';
import { UserService } from '../user/user.service';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { User } from '../user/entities/user.entity';
import { ValidationException } from '../../common/exceptions';

describe('MigrationController', () => {
  let controller: MigrationController;
  let service: MigrationService;
  let metadataResolutionService: jest.Mocked<MetadataResolutionService>;
  let reviewThresholdService: jest.Mocked<ReviewThresholdService>;
  let ragBatchService: jest.Mocked<RagBatchService>;
  let migrationReviewService: jest.Mocked<MigrationReviewService>;
  let legacyIngestionService: jest.Mocked<LegacyIngestionService>;

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
          provide: MigrationReviewService,
          useValue: {
            updateQueueOcr: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: LegacyIngestionService,
          useValue: {
            startIngestion: jest
              .fn()
              .mockResolvedValue({ status: 'COMPLETED' }),
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
    migrationReviewService = module.get(MigrationReviewService);
    legacyIngestionService = module.get(LegacyIngestionService);
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
        mustChangePassword: false,
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
        'idem-key-001',
        { user_id: 5 } as User
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

      await controller.resolveBatch({}, 'idem-key-002', { user_id: 5 } as User);

      expect(metadataResolutionService.resolveBatch).toHaveBeenCalledWith(
        undefined
      );
    });

    it('throws ValidationException when Idempotency-Key is missing (ADR-016)', async () => {
      await expect(
        controller.resolveBatch({ batchId: 'b1' }, undefined, {
          user_id: 5,
        } as User)
      ).rejects.toThrow(ValidationException);
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
        mustChangePassword: false,
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

    it('throws UnauthorizedException when user is undefined (ADR-016)', async () => {
      reviewThresholdService.updateThresholds.mockResolvedValue({
        maxMismatchFields: 3,
        minConfidence: 0.7,
      });

      await expect(
        controller.updateReviewThresholds(
          { maxMismatchFields: 3 },
          'idem-key-004',
          undefined as unknown as User
        )
      ).rejects.toThrow(UnauthorizedException);
      expect(reviewThresholdService.updateThresholds).not.toHaveBeenCalled();
    });

    it('throws ValidationException when Idempotency-Key is missing (ADR-016)', async () => {
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
        mustChangePassword: false,
        generatePublicId: jest.fn(),
      };

      await expect(
        controller.updateReviewThresholds(
          { maxMismatchFields: 5 },
          undefined,
          user
        )
      ).rejects.toThrow(ValidationException);
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
        'idem-key-rag-001',
        {
          user_id: 5,
        } as User
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

      await controller.triggerRagBatch({}, 'idem-key-rag-002', {
        user_id: 5,
      } as User);

      expect(ragBatchService.triggerRagBatch).toHaveBeenCalledWith(undefined);
    });

    it('throws ValidationException when Idempotency-Key is missing (ADR-016)', async () => {
      await expect(
        controller.triggerRagBatch({ batchId: 'b1' }, undefined, {
          user_id: 5,
        } as User)
      ).rejects.toThrow(ValidationException);
      expect(ragBatchService.triggerRagBatch).not.toHaveBeenCalled();
    });
  });

  describe('POST /queue/:publicId/reject (ADR-016)', () => {
    it('calls migrationService.rejectQueueItemByPublicId with publicId (ADR-019)', async () => {
      service.rejectQueueItemByPublicId = jest
        .fn()
        .mockResolvedValue({ success: true });

      await controller.rejectQueueItem(
        '019505a1-7c3e-7000-8000-queue001',
        'idem-key-reject-001',
        {
          user_id: 5,
        } as User
      );

      expect(service.rejectQueueItemByPublicId).toHaveBeenCalledWith(
        '019505a1-7c3e-7000-8000-queue001',
        5
      );
    });

    it('throws ValidationException when Idempotency-Key is missing (ADR-016)', async () => {
      await expect(
        controller.rejectQueueItem(
          '019505a1-7c3e-7000-8000-queue001',
          undefined,
          { user_id: 5 } as User
        )
      ).rejects.toThrow(ValidationException);
    });
  });

  describe('ADR-047: Ingestion & OCR Endpoints', () => {
    it('uploadExcelFile returns file info when file is provided', () => {
      const mockFile = {
        path: '/tmp/test.xlsx',
        originalname: 'test.xlsx',
        size: 1024,
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as MulterFile;

      // SEV-001: ParseFilePipe ทำงานที่ NestJS runtime level (ไม่ใช่ใน method body)
      // การเรียก method ตรงๆ ใน unit test จะข้าม pipe — ตรวจ method logic เท่านั้น
      const res = controller.uploadExcelFile(mockFile);
      expect(res.filePath).toBe('/tmp/test.xlsx');
      expect(res.originalFilename).toBe('test.xlsx');
    });

    it('uploadExcelFile throws when file is undefined (ParseFilePipe handles at runtime)', () => {
      // SEV-001: ParseFilePipe with MaxFileSizeValidator + FileTypeValidator
      // จะ throw BadRequestException ที่ runtime เมื่อ file หาย —
      // ใน unit test การเรียกตรงจะเจอ TypeError ที่ file.path
      expect(() =>
        controller.uploadExcelFile(undefined as unknown as MulterFile)
      ).toThrow(TypeError);
    });

    it('startIngestion awaits and returns ingestion summary', async () => {
      const dto = {
        filePath: '/tmp/test.xlsx',
        projectPublicId: '019505a1-7c3e-7000-8000-proj001',
      };
      const res = await controller.startIngestion(dto, 'idem-key-ingest-001');
      expect(res.message).toContain('completed');
      expect(res.status).toBe('COMPLETED');
      expect(legacyIngestionService.startIngestion).toHaveBeenCalledWith(dto);
    });

    it('updateQueueOcr calls migrationReviewService.updateQueueOcr with user_id (ADR-016: Idempotency-Key)', async () => {
      const user = { user_id: 3 } as User;
      const dto = { ocrText: 'corrected text', reEmbed: true };

      await controller.updateQueueOcr(
        '019505a1-7c3e-7000-8000-queue001',
        dto,
        'idem-key-ocr-001',
        user
      );

      expect(migrationReviewService.updateQueueOcr).toHaveBeenCalledWith(
        '019505a1-7c3e-7000-8000-queue001',
        dto,
        3
      );
    });

    it('updateQueueOcr throws ValidationException when Idempotency-Key is missing (ADR-016)', async () => {
      const user = { user_id: 3 } as User;
      const dto = { ocrText: 'corrected text', reEmbed: true };

      await expect(
        controller.updateQueueOcr(
          '019505a1-7c3e-7000-8000-queue001',
          dto,
          undefined,
          user
        )
      ).rejects.toThrow(ValidationException);
    });
  });

  describe('commitBatch', () => {
    it('should call migrationService.commitBatch with dto, key, and userId', async () => {
      service.commitBatch = jest.fn().mockResolvedValue({ success: true });
      const dto = { queuePublicIds: ['uuid-1', 'uuid-2'] };
      const user = { user_id: 5 } as User;

      const result = await controller.commitBatch(dto, 'idem-key-1', user);

      expect(service.commitBatch).toHaveBeenCalledWith(dto, 'idem-key-1', 5);
      expect(result).toEqual({ success: true });
    });

    it('should throw ValidationException when Idempotency-Key is missing', async () => {
      const dto = { queuePublicIds: ['uuid-1'] };
      const user = { user_id: 5 } as User;

      await expect(
        controller.commitBatch(dto, undefined, user)
      ).rejects.toThrow(ValidationException);
    });

    it('should throw UnauthorizedException when user is undefined', async () => {
      const dto = { queuePublicIds: ['uuid-1'] };

      await expect(
        controller.commitBatch(dto, 'idem-key-1', undefined as unknown as User)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('enqueueRecord', () => {
    it('should call migrationService.enqueueRecord with dto', async () => {
      service.enqueueRecord = jest
        .fn()
        .mockResolvedValue({ publicId: 'uuid-1' });
      const dto = { batchId: 'batch-1', documentNumber: 'DOC-001' };

      const result = await controller.enqueueRecord(dto, 'idem-key-1');

      expect(service.enqueueRecord).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ publicId: 'uuid-1' });
    });

    it('should throw ValidationException when Idempotency-Key is missing', async () => {
      const dto = { batchId: 'batch-1' };

      await expect(controller.enqueueRecord(dto, undefined)).rejects.toThrow(
        ValidationException
      );
    });
  });

  describe('getReviewQueue', () => {
    it('should call migrationService.getReviewQueue with query', async () => {
      service.getReviewQueue = jest
        .fn()
        .mockResolvedValue({ data: [], total: 0 });
      const query = { page: 1, limit: 20 };

      const result = await controller.getReviewQueue(query as never);

      expect(service.getReviewQueue).toHaveBeenCalledWith(query);
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('getQueueBatches', () => {
    it('should call migrationService.getQueueBatches and wrap in object', async () => {
      service.getQueueBatches = jest
        .fn()
        .mockResolvedValue(['batch-1', 'batch-2']);

      const result = await controller.getQueueBatches();

      expect(service.getQueueBatches).toHaveBeenCalled();
      expect(result).toEqual({ batches: ['batch-1', 'batch-2'] });
    });
  });

  describe('getQueueItemByPublicId', () => {
    it('should call migrationService.getQueueItemByPublicId with publicId', async () => {
      service.getQueueItemByPublicId = jest
        .fn()
        .mockResolvedValue({ publicId: 'uuid-1' });

      const result = await controller.getQueueItemByPublicId(
        '019505a1-7c3e-7000-8000-queue001'
      );

      expect(service.getQueueItemByPublicId).toHaveBeenCalledWith(
        '019505a1-7c3e-7000-8000-queue001'
      );
      expect(result).toEqual({ publicId: 'uuid-1' });
    });
  });

  describe('createError', () => {
    it('should call migrationService.createError with dto', async () => {
      service.createError = jest.fn().mockResolvedValue({ success: true });
      const dto = { batchId: 'batch-1', error: 'test error' };

      const result = await controller.createError(dto, 'idem-key-1');

      expect(service.createError).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true });
    });

    it('should throw ValidationException when Idempotency-Key is missing', async () => {
      const dto = { batchId: 'batch-1', error: 'test' };

      await expect(controller.createError(dto, undefined)).rejects.toThrow(
        ValidationException
      );
    });
  });

  describe('getErrorBatches', () => {
    it('should call migrationService.getErrorBatches and wrap in object', async () => {
      service.getErrorBatches = jest.fn().mockResolvedValue(['err-batch-1']);

      const result = await controller.getErrorBatches();

      expect(service.getErrorBatches).toHaveBeenCalled();
      expect(result).toEqual({ batches: ['err-batch-1'] });
    });
  });

  describe('getErrors', () => {
    it('should call migrationService.getErrors with page and limit', async () => {
      service.getErrors = jest.fn().mockResolvedValue({ data: [], total: 0 });

      const result = await controller.getErrors(1, 20);

      expect(service.getErrors).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should call migrationService.getErrors with undefined params', async () => {
      service.getErrors = jest.fn().mockResolvedValue({ data: [], total: 0 });

      await controller.getErrors();

      expect(service.getErrors).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('deleteReviewQueue', () => {
    it('should call migrationService.deleteReviewQueueByBatch with batchId', async () => {
      service.deleteReviewQueueByBatch = jest
        .fn()
        .mockResolvedValue({ deleted: 5 });

      const result = await controller.deleteReviewQueue(
        'batch-1',
        undefined,
        undefined,
        'idem-key-1'
      );

      expect(service.deleteReviewQueueByBatch).toHaveBeenCalledWith(
        'batch-1',
        false,
        undefined
      );
      expect(result).toEqual({ deleted: 5 });
    });

    it('should parse all flag from string "true"', async () => {
      service.deleteReviewQueueByBatch = jest
        .fn()
        .mockResolvedValue({ deleted: 10 });

      await controller.deleteReviewQueue(
        undefined,
        'true',
        undefined,
        'idem-key-1'
      );

      expect(service.deleteReviewQueueByBatch).toHaveBeenCalledWith(
        undefined,
        true,
        undefined
      );
    });

    it('should parse all flag from string "1"', async () => {
      service.deleteReviewQueueByBatch = jest
        .fn()
        .mockResolvedValue({ deleted: 10 });

      await controller.deleteReviewQueue(
        undefined,
        '1',
        undefined,
        'idem-key-1'
      );

      expect(service.deleteReviewQueueByBatch).toHaveBeenCalledWith(
        undefined,
        true,
        undefined
      );
    });

    it('should parse comma-separated publicIds', async () => {
      service.deleteReviewQueueByBatch = jest
        .fn()
        .mockResolvedValue({ deleted: 3 });

      await controller.deleteReviewQueue(
        undefined,
        undefined,
        'uuid-1, uuid-2,uuid-3',
        'idem-key-1'
      );

      expect(service.deleteReviewQueueByBatch).toHaveBeenCalledWith(
        undefined,
        false,
        ['uuid-1', 'uuid-2', 'uuid-3']
      );
    });

    it('should throw ValidationException when Idempotency-Key is missing', async () => {
      await expect(
        controller.deleteReviewQueue('batch-1', undefined, undefined, undefined)
      ).rejects.toThrow(ValidationException);
    });
  });

  describe('deleteErrors', () => {
    it('should call migrationService.deleteErrorsByBatch with batchId', async () => {
      service.deleteErrorsByBatch = jest.fn().mockResolvedValue({ deleted: 3 });

      const result = await controller.deleteErrors(
        'batch-1',
        undefined,
        'idem-key-1'
      );

      expect(service.deleteErrorsByBatch).toHaveBeenCalledWith(
        'batch-1',
        false
      );
      expect(result).toEqual({ deleted: 3 });
    });

    it('should parse all flag from string "true"', async () => {
      service.deleteErrorsByBatch = jest
        .fn()
        .mockResolvedValue({ deleted: 10 });

      await controller.deleteErrors(undefined, 'true', 'idem-key-1');

      expect(service.deleteErrorsByBatch).toHaveBeenCalledWith(undefined, true);
    });

    it('should throw ValidationException when Idempotency-Key is missing', async () => {
      await expect(
        controller.deleteErrors('batch-1', undefined, undefined)
      ).rejects.toThrow(ValidationException);
    });
  });

  describe('approveQueueItem', () => {
    it('should call migrationService.approveQueueItemByPublicId', async () => {
      service.approveQueueItemByPublicId = jest
        .fn()
        .mockResolvedValue({ success: true });
      const dto = {
        documentNumber: 'DOC-001',
        subject: 'Test',
      } as ImportCorrespondenceDto;
      const user = { user_id: 5 } as User;

      const result = await controller.approveQueueItem(
        '019505a1-7c3e-7000-8000-queue001',
        dto,
        'idem-key-1',
        user
      );

      expect(service.approveQueueItemByPublicId).toHaveBeenCalledWith(
        '019505a1-7c3e-7000-8000-queue001',
        dto,
        'idem-key-1',
        5
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw UnauthorizedException when user is undefined', async () => {
      const dto = {} as ImportCorrespondenceDto;

      await expect(
        controller.approveQueueItem(
          'uuid-1',
          dto,
          'idem-key-1',
          undefined as unknown as User
        )
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ValidationException when Idempotency-Key is missing', async () => {
      const dto = {} as ImportCorrespondenceDto;
      const user = { user_id: 5 } as User;

      await expect(
        controller.approveQueueItem('uuid-1', dto, undefined, user)
      ).rejects.toThrow(ValidationException);
    });
  });

  describe('extractQueueItem', () => {
    it('should call migrationService.startExtractQueueItem', async () => {
      service.startExtractQueueItem = jest
        .fn()
        .mockResolvedValue({ success: true });
      const user = { user_id: 5 } as User;

      const result = await controller.extractQueueItem(
        '019505a1-7c3e-7000-8000-queue001',
        'idem-key-1',
        user
      );

      expect(service.startExtractQueueItem).toHaveBeenCalledWith(
        '019505a1-7c3e-7000-8000-queue001',
        'idem-key-1',
        5
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw ValidationException when Idempotency-Key is missing', async () => {
      const user = { user_id: 5 } as User;

      await expect(
        controller.extractQueueItem('uuid-1', undefined, user)
      ).rejects.toThrow(ValidationException);
    });
  });

  describe('extractBatch', () => {
    it('should call migrationService.startExtractBatch', async () => {
      service.startExtractBatch = jest
        .fn()
        .mockResolvedValue({ success: true });
      const dto = { queuePublicIds: ['uuid-1', 'uuid-2'] };
      const user = { user_id: 5 } as User;

      const result = await controller.extractBatch(dto, 'idem-key-1', user);

      expect(service.startExtractBatch).toHaveBeenCalledWith(
        ['uuid-1', 'uuid-2'],
        'idem-key-1',
        5
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw ValidationException when Idempotency-Key is missing', async () => {
      const dto = { queuePublicIds: ['uuid-1'] };
      const user = { user_id: 5 } as User;

      await expect(
        controller.extractBatch(dto, undefined, user)
      ).rejects.toThrow(ValidationException);
    });
  });

  describe('importCorrespondence - error cases', () => {
    it('should throw UnauthorizedException when user is undefined', async () => {
      const dto = {} as ImportCorrespondenceDto;

      await expect(
        controller.importCorrespondence(
          dto,
          'idem-key-1',
          undefined as unknown as User
        )
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ValidationException when Idempotency-Key is missing', async () => {
      const dto = {} as ImportCorrespondenceDto;
      const user = { user_id: 5 } as User;

      await expect(
        controller.importCorrespondence(dto, undefined, user)
      ).rejects.toThrow(ValidationException);
    });
  });

  describe('rejectQueueItem - error cases', () => {
    it('should throw UnauthorizedException when user is undefined', async () => {
      await expect(
        controller.rejectQueueItem(
          'uuid-1',
          'idem-key-1',
          undefined as unknown as User
        )
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('listLegacyExcelFiles', () => {
    it('should return empty files when NAS path does not exist', () => {
      const result = controller.listLegacyExcelFiles();

      expect(result).toEqual({ files: [] });
    });
  });

  describe('listLegacyFolders', () => {
    it('should return empty tree when NAS path does not exist', () => {
      const result = controller.listLegacyFolders();

      expect(result).toEqual({ tree: [] });
    });
  });
});
