import { Test, TestingModule } from '@nestjs/testing';
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

describe('DocumentNumberingService', () => {
  let service: DocumentNumberingService;
  let module: TestingModule;
  let counterService: CounterService;
  let formatService: FormatService;

  const mockContext = {
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
            getCurrentSequence: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: ReservationService,
          useValue: {
            reserve: jest.fn(),
            confirm: jest.fn(),
            cancel: jest.fn(),
          },
        },
        {
          provide: FormatService,
          useValue: {
            format: jest.fn().mockResolvedValue('0001'),
          },
        },
        {
          provide: DocumentNumberingLockService,
          useValue: {
            acquireLock: jest.fn().mockResolvedValue({ release: jest.fn() }),
            releaseLock: jest.fn(),
          },
        },
        {
          provide: ManualOverrideService,
          useValue: { applyOverride: jest.fn() },
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
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(DocumentNumberAudit),
          useValue: {
            create: jest.fn().mockReturnValue({ id: 1 }),
            save: jest.fn().mockResolvedValue({ id: 1 }),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DocumentNumberError),
          useValue: {
            create: jest.fn().mockReturnValue({}),
            save: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentNumberingService>(DocumentNumberingService);
    counterService = module.get<CounterService>(CounterService);
    formatService = module.get<FormatService>(FormatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateNextNumber', () => {
    it('should generate a new number successfully', async () => {
      (counterService.incrementCounter as jest.Mock).mockResolvedValue(1);
      (formatService.format as jest.Mock).mockResolvedValue('DOC-0001');

      const result = await service.generateNextNumber(mockContext);

      // Service returns object with number and auditId
      expect(result).toHaveProperty('number');
      expect(result).toHaveProperty('auditId');
      expect(result.number).toBe('DOC-0001');
      expect(counterService.incrementCounter).toHaveBeenCalled();
      expect(formatService.format).toHaveBeenCalled();
    });

    it('should throw error when increment fails', async () => {
      // Mock CounterService to throw error
      (counterService.incrementCounter as jest.Mock).mockRejectedValue(
        new Error('Transaction failed')
      );

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow(
        'Transaction failed'
      );
    });
  });

  describe('Admin Operations', () => {
    it('voidAndReplace should verify audit log exists', async () => {
      const auditRepo = module.get(getRepositoryToken(DocumentNumberAudit));
      (auditRepo.findOne as jest.Mock).mockResolvedValue({
        generatedNumber: 'DOC-001',
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
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('cancelNumber should log cancellation', async () => {
      const auditRepo = module.get(getRepositoryToken(DocumentNumberAudit));
      (auditRepo.findOne as jest.Mock).mockResolvedValue({
        generatedNumber: 'DOC-002',
        counterKey: {},
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
  });
});
