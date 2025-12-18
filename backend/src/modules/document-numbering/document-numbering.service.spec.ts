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

// Mock Redis and Redlock (legacy mocks, kept just in case)
const mockRedis = {
  disconnect: jest.fn(),
  on: jest.fn(),
};
const mockRedlock = {
  acquire: jest.fn(),
};
const mockLock = {
  release: jest.fn().mockResolvedValue(undefined),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});
jest.mock('redlock', () => {
  return jest.fn().mockImplementation(() => {
    return mockRedlock;
  });
});

describe('DocumentNumberingService', () => {
  let service: DocumentNumberingService;
  let module: TestingModule;
  let counterService: CounterService;
  let formatService: FormatService;

  const mockContext = {
    projectId: 1,
    originatorOrganizationId: 1,
    typeId: 1,
    disciplineId: 1,
    year: 2025,
    customTokens: { TYPE_CODE: 'COR', ORG_CODE: 'GGL' },
  };

  beforeEach(async () => {
    mockRedlock.acquire.mockResolvedValue(mockLock);

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
          provide: getRepositoryToken(DocumentNumberFormat),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(DocumentNumberAudit),
          useValue: {
            create: jest.fn().mockReturnValue({ id: 1 }),
            save: jest.fn().mockResolvedValue({ id: 1 }),
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
});
