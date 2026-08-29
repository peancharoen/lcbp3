// File: backend/src/modules/document-numbering/document-numbering.service.spec.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for DocumentNumberingService
// - 2026-08-28: Extended with comprehensive tests for all methods (80%+ coverage target)

import { Test, TestingModule } from '@nestjs/testing';
import { Repository, EntityManager } from 'typeorm';
import { DocumentNumberingService } from './services/document-numbering.service';
import { CounterService } from './services/counter.service';
import { ReservationService } from './services/reservation.service';
import { FormatService } from './services/format.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DocumentNumberFormat } from './entities/document-number-format.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity';
import { DocumentNumberError } from './entities/document-number-error.entity';

import { DocumentNumberingLockService } from './services/document-numbering-lock.service';
import { ManualOverrideService } from './services/manual-override.service';
import { MetricsService } from './services/metrics.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { BusinessException } from '../../common/exceptions';
import { GenerateNumberContext } from './interfaces/document-numbering.interface';
import { ManualOverrideDto } from './dto/manual-override.dto';

describe('DocumentNumberingService', () => {
  let service: DocumentNumberingService;
  let module: TestingModule;
  let counterService: CounterService;
  let formatService: FormatService;
  let lockService: DocumentNumberingLockService;
  let reservationService: ReservationService;
  let manualOverrideService: ManualOverrideService;
  let uuidResolver: UuidResolverService;
  let formatRepo: Repository<DocumentNumberFormat>;
  let auditRepo: Repository<DocumentNumberAudit>;
  let errorRepo: Repository<DocumentNumberError>;

  const mockContext: GenerateNumberContext = {
    projectId: 1,
    originatorOrganizationId: 1,
    recipientOrganizationId: 1,
    typeId: 1,
    subTypeId: 1,
    rfaTypeId: 1,
    disciplineId: 1,
    year: 2025,
    customTokens: { TYPE_CODE: 'COR', ORG_CODE: 'GGL' },
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        DocumentNumberingService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('localhost') },
        },
        {
          provide: CounterService,
          useValue: {
            incrementCounter: jest.fn().mockResolvedValue(1),
            getCurrentCounter: jest.fn().mockResolvedValue(0),
            getCurrentSequence: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: ReservationService,
          useValue: {
            reserve: jest.fn().mockResolvedValue({
              token: 'token-123',
              documentNumber: 'DOC-0001',
              expiresAt: new Date(),
            }),
            confirm: jest.fn().mockResolvedValue({
              documentNumber: 'DOC-0001',
              confirmedAt: new Date(),
            }),
            cancel: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: FormatService,
          useValue: {
            format: jest
              .fn()
              .mockResolvedValue({ previewNumber: '0001', isDefault: false }),
          },
        },
        {
          provide: DocumentNumberingLockService,
          useValue: {
            acquireLock: jest.fn().mockResolvedValue({ release: jest.fn() }),
            releaseLock: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ManualOverrideService,
          useValue: { applyOverride: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: MetricsService,
          useValue: {
            numbersGenerated: { inc: jest.fn() },
            lockFailures: { inc: jest.fn() },
          },
        },
        {
          provide: getRepositoryToken(DocumentNumberFormat),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockResolvedValue({ id: 1 }),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(DocumentNumberAudit),
          useValue: {
            create: jest.fn().mockReturnValue({ id: 1 }),
            save: jest.fn().mockResolvedValue({ id: 1 }),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(DocumentNumberError),
          useValue: {
            create: jest.fn().mockReturnValue({}),
            save: jest.fn().mockResolvedValue({}),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: EntityManager,
          useValue: { transaction: jest.fn() },
        },
        {
          provide: UuidResolverService,
          useValue: {
            resolveProjectId: jest.fn().mockResolvedValue(1),
            resolveOrganizationId: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentNumberingService>(DocumentNumberingService);
    counterService = module.get<CounterService>(CounterService);
    formatService = module.get<FormatService>(FormatService);
    lockService = module.get<DocumentNumberingLockService>(
      DocumentNumberingLockService
    );
    reservationService = module.get<ReservationService>(ReservationService);
    manualOverrideService = module.get<ManualOverrideService>(
      ManualOverrideService
    );
    uuidResolver = module.get<UuidResolverService>(UuidResolverService);
    formatRepo = module.get<Repository<DocumentNumberFormat>>(
      getRepositoryToken(DocumentNumberFormat)
    );
    auditRepo = module.get<Repository<DocumentNumberAudit>>(
      getRepositoryToken(DocumentNumberAudit)
    );
    errorRepo = module.get<Repository<DocumentNumberError>>(
      getRepositoryToken(DocumentNumberError)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveIdForPreview', () => {
    it('should resolve project ID', async () => {
      const result = await service.resolveIdForPreview('project', 'uuid-123');
      expect(uuidResolver.resolveProjectId).toHaveBeenCalledWith('uuid-123');
      expect(result).toBe(1);
    });

    it('should resolve organization ID', async () => {
      const result = await service.resolveIdForPreview(
        'organization',
        'uuid-456'
      );
      expect(uuidResolver.resolveOrganizationId).toHaveBeenCalledWith(
        'uuid-456'
      );
      expect(result).toBe(1);
    });
  });

  describe('generateNextNumber', () => {
    it('should generate a new number successfully', async () => {
      (counterService.incrementCounter as jest.Mock).mockResolvedValue(1);
      (formatService.format as jest.Mock).mockResolvedValue({
        previewNumber: 'DOC-0001',
        isDefault: false,
      });

      const result = await service.generateNextNumber(mockContext);

      expect(result).toHaveProperty('number');
      expect(result).toHaveProperty('auditId');
      expect(result.number).toBe('DOC-0001');
      expect(counterService.incrementCounter as jest.Mock).toHaveBeenCalled();
      expect(formatService.format as jest.Mock).toHaveBeenCalled();
    });

    it('should throw error when increment fails', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('Transaction failed')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow(
        'Transaction failed'
      );
    });

    it('should throw error when format fails', async () => {
      (counterService.incrementCounter as jest.Mock).mockResolvedValue(1);
      (formatService.format as jest.Mock).mockRejectedValue(
        new Error('Format failed')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow(
        'Format failed'
      );
    });

    it('should fallback to DB lock when Redis lock fails', async () => {
      (lockService.acquireLock as jest.Mock).mockRejectedValueOnce(
        new Error('Redis lock failed')
      );
      (counterService.incrementCounter as jest.Mock).mockResolvedValue(5);
      (formatService.format as jest.Mock).mockResolvedValue({
        previewNumber: 'DOC-0005',
        isDefault: false,
      });

      const result = await service.generateNextNumber(mockContext);

      expect(result.number).toBe('DOC-0005');
      expect(lockService.releaseLock).not.toHaveBeenCalled();
    });

    it('should release lock in finally block on success', async () => {
      const mockLock = { release: jest.fn() };
      (lockService.acquireLock as jest.Mock).mockResolvedValue(mockLock);
      (counterService.incrementCounter as jest.Mock).mockResolvedValue(1);
      (formatService.format as jest.Mock).mockResolvedValue({
        previewNumber: 'DOC-0001',
        isDefault: false,
      });

      await service.generateNextNumber(mockContext);

      expect(lockService.releaseLock).toHaveBeenCalledWith(mockLock);
    });

    it('should release lock in finally block on error', async () => {
      const mockLock = { release: jest.fn() };
      (lockService.acquireLock as jest.Mock).mockResolvedValue(mockLock);
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('Counter error')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow(
        'Counter error'
      );
      expect(lockService.releaseLock).toHaveBeenCalledWith(mockLock);
    });

    it('should log error with VERSION_CONFLICT type', async () => {
      const conflictError = new Error('version conflict detected');
      conflictError.name = 'ConflictException';
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        conflictError
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow();
      expect(errorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'VERSION_CONFLICT' })
      );
    });

    it('should log error with LOCK_TIMEOUT type', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('lock timeout occurred')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow();
      expect(errorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'LOCK_TIMEOUT' })
      );
    });

    it('should log error with REDIS_ERROR type', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('Redis connection lost')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow();
      expect(errorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'REDIS_ERROR' })
      );
    });

    it('should log error with DUPLICATE_NUMBER type', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('duplicate key violation')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow();
      expect(errorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'DUPLICATE_NUMBER' })
      );
    });

    it('should log error with VALIDATION_ERROR type', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('validation failed for field')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow();
      expect(errorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'VALIDATION_ERROR' })
      );
    });

    it('should log error with SEQUENCE_EXHAUSTED type', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('sequence exhausted: maximum reached')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow();
      expect(errorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'SEQUENCE_EXHAUSTED' })
      );
    });

    it('should log error with RESERVATION_EXPIRED type', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('reservation expired')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow();
      expect(errorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'RESERVATION_EXPIRED' })
      );
    });

    it('should log error with DB_ERROR type', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('database query failed')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow();
      expect(errorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'DB_ERROR' })
      );
    });

    it('should log error with GENERATE_ERROR type (default)', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('something unexpected')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow();
      expect(errorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorType: 'GENERATE_ERROR' })
      );
    });

    it('should handle non-Error thrown values in logError', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        'string error'
      );

      // non-Error values are re-thrown as-is (not wrapped in Error)
      await expect(service.generateNextNumber(mockContext)).rejects.toBe(
        'string error'
      );
      expect(errorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorMessage: 'string error' })
      );
    });

    it('should not throw when logError itself fails', async () => {
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('Counter failed')
      );
      (errorRepo.save as jest.Mock).mockRejectedValueOnce(
        new Error('Log DB down')
      );

      // The original error should still be thrown, not the logError failure
      await expect(service.generateNextNumber(mockContext)).rejects.toThrow(
        'Counter failed'
      );
    });
  });

  describe('reserveNumber', () => {
    it('should delegate to ReservationService.reserve', async () => {
      const dto = {
        projectId: 1,
        originatorOrganizationId: 2,
        recipientOrganizationId: 3,
        correspondenceTypeId: 4,
        subTypeId: 5,
        rfaTypeId: 0,
        disciplineId: 0,
        metadata: {},
      };

      const result = await service.reserveNumber(dto, 1, '127.0.0.1');

      expect(reservationService.reserve).toHaveBeenCalledWith(
        dto,
        1,
        '127.0.0.1',
        'Unknown'
      );
      expect(result).toHaveProperty('token');
    });

    it('should use 0.0.0.0 when ipAddress is not provided', async () => {
      const dto = {
        projectId: 1,
        originatorOrganizationId: 2,
        recipientOrganizationId: 3,
        correspondenceTypeId: 4,
        subTypeId: 5,
        rfaTypeId: 0,
        disciplineId: 0,
        metadata: {},
      };

      await service.reserveNumber(dto, 1);

      expect(reservationService.reserve).toHaveBeenCalledWith(
        dto,
        1,
        '0.0.0.0',
        'Unknown'
      );
    });

    it('should rethrow error when reservation fails', async () => {
      (reservationService.reserve as jest.Mock).mockRejectedValue(
        new Error('Reservation failed')
      );

      const dto = {
        projectId: 1,
        originatorOrganizationId: 2,
        recipientOrganizationId: 3,
        correspondenceTypeId: 4,
        subTypeId: 5,
        rfaTypeId: 0,
        disciplineId: 0,
        metadata: {},
      };

      await expect(service.reserveNumber(dto, 1)).rejects.toThrow(
        'Reservation failed'
      );
    });
  });

  describe('confirmReservation', () => {
    it('should delegate to ReservationService.confirm', async () => {
      const dto = { token: 'tok-123', documentId: 99 };

      const result = await service.confirmReservation(dto, 1);

      expect(reservationService.confirm).toHaveBeenCalledWith(dto, 1);
      expect(result).toHaveProperty('documentNumber');
    });
  });

  describe('cancelReservation', () => {
    it('should delegate to ReservationService.cancel', async () => {
      await service.cancelReservation('tok-123', 1);

      expect(reservationService.cancel).toHaveBeenCalledWith('tok-123', 1);
    });
  });

  describe('previewNumber', () => {
    it('should preview next number without incrementing', async () => {
      (counterService.getCurrentCounter as jest.Mock).mockResolvedValue(10);
      (formatService.format as jest.Mock).mockResolvedValue({
        previewNumber: 'DOC-0011',
        isDefault: false,
      });

      const result = await service.previewNumber(mockContext);

      expect(result.previewNumber).toBe('DOC-0011');
      expect(result.nextSequence).toBe(11);
      expect(result.isDefault).toBe(false);
      expect(counterService.getCurrentCounter).toHaveBeenCalled();
    });

    it('should handle default format flag', async () => {
      (counterService.getCurrentCounter as jest.Mock).mockResolvedValue(0);
      (formatService.format as jest.Mock).mockResolvedValue({
        previewNumber: 'DOC-0001',
        isDefault: true,
      });

      const result = await service.previewNumber(mockContext);

      expect(result.isDefault).toBe(true);
      expect(result.nextSequence).toBe(1);
    });
  });

  describe('updateNumberForDraft', () => {
    it('should generate new number for updated draft context', async () => {
      (counterService.incrementCounter as jest.Mock).mockResolvedValue(1);
      (formatService.format as jest.Mock).mockResolvedValue({
        previewNumber: 'DOC-NEW-001',
        isDefault: false,
      });

      const oldCtx: GenerateNumberContext = {
        projectId: 1,
        originatorOrganizationId: 1,
        typeId: 1,
      };
      const newCtx: GenerateNumberContext = {
        projectId: 1,
        originatorOrganizationId: 2,
        typeId: 1,
      };

      const result = await service.updateNumberForDraft(
        'OLD-001',
        oldCtx,
        newCtx
      );

      expect(result).toBe('DOC-NEW-001');
    });
  });

  describe('getTemplates', () => {
    it('should return all templates with relations', async () => {
      (formatRepo.find as jest.Mock).mockResolvedValue([
        { id: 1, formatTemplate: '{ORG}-{SEQ:4}' },
      ]);

      const result = await service.getTemplates();

      expect(result).toHaveLength(1);
      expect(formatRepo.find).toHaveBeenCalledWith({
        relations: ['project', 'correspondenceType'],
      });
    });
  });

  describe('getTemplatesByProject', () => {
    it('should return templates by project ID (numeric)', async () => {
      (formatRepo.find as jest.Mock).mockResolvedValue([
        { id: 1, projectId: 1 },
      ]);

      const result = await service.getTemplatesByProject(1);

      expect(result).toHaveLength(1);
      expect(uuidResolver.resolveProjectId).toHaveBeenCalledWith(1);
    });

    it('should resolve UUID project ID to internal ID', async () => {
      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(42);
      (formatRepo.find as jest.Mock).mockResolvedValue([]);

      await service.getTemplatesByProject('uuid-project-123');

      expect(uuidResolver.resolveProjectId).toHaveBeenCalledWith(
        'uuid-project-123'
      );
      expect(formatRepo.find).toHaveBeenCalledWith({
        where: { projectId: 42 },
        relations: ['project', 'correspondenceType'],
      });
    });
  });

  describe('saveTemplate', () => {
    it('should save new template without existing match', async () => {
      (formatRepo.findOne as jest.Mock).mockResolvedValue(null);
      (formatRepo.save as jest.Mock).mockResolvedValue({ id: 10 });

      const result = await service.saveTemplate({
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 0,
        formatTemplate: '{ORG}-{SEQ:4}',
      });

      expect(result.id).toBe(10);
      expect(formatRepo.save).toHaveBeenCalled();
    });

    it('should resolve string projectId to internal ID', async () => {
      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(99);
      (formatRepo.findOne as jest.Mock).mockResolvedValue(null);
      (formatRepo.save as jest.Mock).mockResolvedValue({ id: 11 });

      await service.saveTemplate({
        projectId: 'uuid-proj-123',
        correspondenceTypeId: 2,
        disciplineId: 0,
        formatTemplate: '{ORG}-{SEQ:4}',
      });

      expect(uuidResolver.resolveProjectId).toHaveBeenCalledWith(
        'uuid-proj-123'
      );
    });

    it('should update existing template when business key matches', async () => {
      (formatRepo.findOne as jest.Mock).mockResolvedValue({
        id: 5,
        projectId: 1,
        correspondenceTypeId: 2,
      });
      (formatRepo.save as jest.Mock).mockResolvedValue({ id: 5 });

      const result = await service.saveTemplate({
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 0,
        formatTemplate: '{ORG}-{SEQ:6}',
      });

      expect(result.id).toBe(5);
    });

    it('should not check for existing when id is provided', async () => {
      (formatRepo.save as jest.Mock).mockResolvedValue({ id: 3 });

      await service.saveTemplate({
        id: 3,
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 0,
        formatTemplate: '{ORG}-{SEQ:8}',
      });

      expect(formatRepo.findOne).not.toHaveBeenCalled();
    });

    it('should rethrow error on save failure', async () => {
      (formatRepo.findOne as jest.Mock).mockResolvedValue(null);
      (formatRepo.save as jest.Mock).mockRejectedValue(
        new Error('DB save failed')
      );

      await expect(
        service.saveTemplate({
          projectId: 1,
          correspondenceTypeId: 2,
          disciplineId: 0,
          formatTemplate: '{ORG}-{SEQ:4}',
        })
      ).rejects.toThrow('DB save failed');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template by ID', async () => {
      (formatRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.deleteTemplate(5);

      expect(formatRepo.delete).toHaveBeenCalledWith(5);
      expect(result).toEqual({ affected: 1 });
    });
  });

  describe('getAuditLogs', () => {
    it('should return audit logs with limit', async () => {
      (auditRepo.find as jest.Mock).mockResolvedValue([
        { id: 1, documentNumber: 'DOC-001' },
      ]);

      const result = await service.getAuditLogs(10);

      expect(result).toHaveLength(1);
      expect(auditRepo.find).toHaveBeenCalledWith({
        take: 10,
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getErrorLogs', () => {
    it('should return error logs with limit', async () => {
      (errorRepo.find as jest.Mock).mockResolvedValue([
        { id: 1, errorMessage: 'Test error' },
      ]);

      const result = await service.getErrorLogs(20);

      expect(result).toHaveLength(1);
      expect(errorRepo.find).toHaveBeenCalledWith({
        take: 20,
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getSequences', () => {
    it('should return empty array', async () => {
      const result = await service.getSequences(1);
      expect(result).toEqual([]);
    });
  });

  describe('setCounterValue', () => {
    it('should throw BusinessException (not supported)', async () => {
      await expect(service.setCounterValue(1, 100)).rejects.toThrow(
        BusinessException
      );
    });
  });

  describe('manualOverride', () => {
    it('should delegate to ManualOverrideService.applyOverride', async () => {
      const dto: ManualOverrideDto = {
        projectId: 1,
        originatorOrganizationId: 2,
        recipientOrganizationId: 3,
        correspondenceTypeId: 4,
        subTypeId: 0,
        rfaTypeId: 0,
        disciplineId: 0,
        resetScope: 'YEAR_2025',
        newLastNumber: 999,
        reason: 'Sync',
      };

      await service.manualOverride(dto, 1);

      expect(manualOverrideService.applyOverride).toHaveBeenCalledWith(dto, 1);
    });
  });

  describe('voidAndReplace', () => {
    it('should void and return VOIDED when replace is false', async () => {
      (auditRepo.findOne as jest.Mock).mockResolvedValue({
        documentNumber: 'DOC-001',
        counterKey: JSON.stringify({ projectId: 1, correspondenceTypeId: 1 }),
        templateUsed: 'test',
      });
      (auditRepo.save as jest.Mock).mockResolvedValue({ id: 2 });

      const result = await service.voidAndReplace({
        documentNumber: 'DOC-001',
        reason: 'test',
        replace: false,
      });

      expect(result.status).toBe('VOIDED');
    });

    it('should return VOIDED_UNKNOWN_CONTEXT when audit not found', async () => {
      (auditRepo.findOne as jest.Mock).mockResolvedValue(null);
      (auditRepo.save as jest.Mock).mockResolvedValue({ id: 99 });

      const result = await service.voidAndReplace({
        documentNumber: 'UNKNOWN-001',
        reason: 'test',
        replace: false,
      });

      expect(result.status).toBe('VOIDED_UNKNOWN_CONTEXT');
    });

    it('should void and replace when replace is true', async () => {
      (auditRepo.findOne as jest.Mock).mockResolvedValue({
        documentNumber: 'DOC-001',
        counterKey: JSON.stringify({
          projectId: 1,
          correspondenceTypeId: 2,
          subTypeId: 0,
          rfaTypeId: 0,
          disciplineId: 0,
          originatorOrganizationId: 3,
          recipientOrganizationId: 4,
        }),
        templateUsed: 'test',
      });
      (auditRepo.save as jest.Mock).mockResolvedValue({ id: 2 });
      (counterService.incrementCounter as jest.Mock).mockResolvedValue(5);
      (formatService.format as jest.Mock).mockResolvedValue({
        previewNumber: 'DOC-NEW-005',
        isDefault: false,
      });

      const result = await service.voidAndReplace({
        documentNumber: 'DOC-001',
        reason: 'voided for replacement',
        replace: true,
      });

      expect(result.status).toBe('REPLACED');
      expect(result).toHaveProperty('oldNumber', 'DOC-001');
      expect(result).toHaveProperty('newNumber', 'DOC-NEW-005');
    });

    it('should return VOIDED_REPLACE_FAILED when generateNextNumber fails', async () => {
      (auditRepo.findOne as jest.Mock).mockResolvedValue({
        documentNumber: 'DOC-001',
        counterKey: JSON.stringify({
          projectId: 1,
          correspondenceTypeId: 2,
          subTypeId: 0,
          rfaTypeId: 0,
          disciplineId: 0,
          originatorOrganizationId: 3,
          recipientOrganizationId: 4,
        }),
        templateUsed: 'test',
      });
      (auditRepo.save as jest.Mock).mockResolvedValue({ id: 2 });
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('Counter exploded')
      );

      const result = await service.voidAndReplace({
        documentNumber: 'DOC-001',
        reason: 'test',
        replace: true,
      });

      expect(result.status).toBe('VOIDED_REPLACE_FAILED');
      expect(result).toHaveProperty('error', 'Counter exploded');
    });

    it('should handle non-string counterKey in voidAndReplace replace', async () => {
      (auditRepo.findOne as jest.Mock).mockResolvedValue({
        documentNumber: 'DOC-001',
        counterKey: {
          projectId: 1,
          correspondenceTypeId: 2,
          subTypeId: 0,
          rfaTypeId: 0,
          disciplineId: 0,
          originatorOrganizationId: 3,
          recipientOrganizationId: 4,
        },
        templateUsed: 'test',
      });
      (auditRepo.save as jest.Mock).mockResolvedValue({ id: 2 });
      (counterService.incrementCounter as jest.Mock).mockResolvedValue(1);
      (formatService.format as jest.Mock).mockResolvedValue({
        previewNumber: 'DOC-NEW',
        isDefault: false,
      });

      const result = await service.voidAndReplace({
        documentNumber: 'DOC-001',
        reason: 'test',
        replace: true,
      });

      expect(result.status).toBe('REPLACED');
    });
  });

  describe('cancelNumber', () => {
    it('should log cancellation when audit exists', async () => {
      (auditRepo.findOne as jest.Mock).mockResolvedValue({
        documentNumber: 'DOC-002',
        counterKey: {},
        templateUsed: 'test',
      });
      (auditRepo.save as jest.Mock).mockResolvedValue({ id: 3 });

      const result = await service.cancelNumber({
        documentNumber: 'DOC-002',
        reason: 'bad',
        projectId: 1,
      });

      expect(result.status).toBe('CANCELLED');
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('should handle cancellation when audit not found', async () => {
      (auditRepo.findOne as jest.Mock).mockResolvedValue(null);
      (auditRepo.save as jest.Mock).mockResolvedValue({ id: 4 });

      const result = await service.cancelNumber({
        documentNumber: 'UNKNOWN-002',
        reason: 'bad',
        projectId: 1,
      });

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('bulkImport', () => {
    it('should import valid items successfully', async () => {
      const items: ManualOverrideDto[] = [
        {
          projectId: 1,
          originatorOrganizationId: 2,
          recipientOrganizationId: 3,
          correspondenceTypeId: 4,
          subTypeId: 0,
          rfaTypeId: 0,
          disciplineId: 0,
          resetScope: 'YEAR_2025',
          newLastNumber: 100,
          reason: 'Import',
        },
      ];

      const result = await service.bulkImport(items);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(manualOverrideService.applyOverride).toHaveBeenCalled();
    });

    it('should skip items without newLastNumber or correspondenceTypeId', async () => {
      const items = [
        {
          projectId: 1,
          originatorOrganizationId: 2,
          recipientOrganizationId: 3,
          subTypeId: 0,
          rfaTypeId: 0,
          disciplineId: 0,
          resetScope: 'YEAR_2025',
          newLastNumber: 100,
          reason: 'Import',
        },
      ];

      const result = await service.bulkImport(
        items as unknown as ManualOverrideDto[]
      );

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
      expect(manualOverrideService.applyOverride).not.toHaveBeenCalled();
    });

    it('should count failures when applyOverride throws', async () => {
      (manualOverrideService.applyOverride as jest.Mock).mockRejectedValue(
        new Error('Override failed')
      );

      const items: ManualOverrideDto[] = [
        {
          projectId: 1,
          originatorOrganizationId: 2,
          recipientOrganizationId: 3,
          correspondenceTypeId: 4,
          subTypeId: 0,
          rfaTypeId: 0,
          disciplineId: 0,
          resetScope: 'YEAR_2025',
          newLastNumber: 100,
          reason: 'Import',
        },
      ];

      const result = await service.bulkImport(items);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle mixed success and failure', async () => {
      (manualOverrideService.applyOverride as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Second failed'));

      const items: ManualOverrideDto[] = [
        {
          projectId: 1,
          originatorOrganizationId: 2,
          recipientOrganizationId: 3,
          correspondenceTypeId: 4,
          subTypeId: 0,
          rfaTypeId: 0,
          disciplineId: 0,
          resetScope: 'YEAR_2025',
          newLastNumber: 100,
          reason: 'Import',
        },
        {
          projectId: 1,
          originatorOrganizationId: 2,
          recipientOrganizationId: 3,
          correspondenceTypeId: 5,
          subTypeId: 0,
          rfaTypeId: 0,
          disciplineId: 0,
          resetScope: 'YEAR_2025',
          newLastNumber: 200,
          reason: 'Import',
        },
      ];

      const result = await service.bulkImport(items);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });
  });
});
