import { Test, TestingModule } from '@nestjs/testing';
import { DocumentNumberingService } from './document-numbering.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DocumentNumberCounter } from './entities/document-number-counter.entity';
import { DocumentNumberFormat } from './entities/document-number-format.entity';
import { Project } from '../project/entities/project.entity';
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { Discipline } from '../master/entities/discipline.entity';
import { CorrespondenceSubType } from '../correspondence/entities/correspondence-sub-type.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity';
import { DocumentNumberError } from './entities/document-number-error.entity';

// Mock Redis and Redlock
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
  let formatRepo: jest.Mocked<{ findOne: jest.Mock }>;

  const mockProject = { id: 1, projectCode: 'LCBP3' };
  const mockOrg = { id: 1, name: 'Google' };
  const mockType = { id: 1, typeCode: 'COR' };
  const mockDiscipline = { id: 1, code: 'CIV' };

  const mockContext = {
    projectId: 1,
    originatorId: 1,
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
          provide: getRepositoryToken(DocumentNumberCounter),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn().mockReturnValue({ lastNumber: 0 }),
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
        // Mock other dependencies used inside generateNextNumber lookups
        {
          provide: getRepositoryToken(Project),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(CorrespondenceType),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Discipline),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(CorrespondenceSubType),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) =>
              cb({
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockReturnValue({ lastSequence: 0 }),
                save: jest.fn().mockResolvedValue({ lastSequence: 1 }),
              })
            ),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentNumberingService>(DocumentNumberingService);
    formatRepo = module.get(getRepositoryToken(DocumentNumberFormat));
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Don't call onModuleDestroy - redisClient is mocked and would cause undefined error
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateNextNumber', () => {
    it('should generate a new number successfully', async () => {
      const projectRepo = module.get(getRepositoryToken(Project));
      const orgRepo = module.get(getRepositoryToken(Organization));
      const typeRepo = module.get(getRepositoryToken(CorrespondenceType));
      const disciplineRepo = module.get(getRepositoryToken(Discipline));

      (projectRepo.findOne as jest.Mock).mockResolvedValue(mockProject);
      (orgRepo.findOne as jest.Mock).mockResolvedValue(mockOrg);
      (typeRepo.findOne as jest.Mock).mockResolvedValue(mockType);
      (disciplineRepo.findOne as jest.Mock).mockResolvedValue(mockDiscipline);
      (formatRepo.findOne as jest.Mock).mockResolvedValue({
        formatTemplate: '{SEQ:4}',
        resetSequenceYearly: true,
      });

      service.onModuleInit();

      const result = await service.generateNextNumber(mockContext);

      // Service returns object with number and auditId
      expect(result).toHaveProperty('number');
      expect(result).toHaveProperty('auditId');
      expect(result.number).toBe('0001'); // Padded to 4 digits
    });

    it('should throw error when transaction fails', async () => {
      const projectRepo = module.get(getRepositoryToken(Project));
      const orgRepo = module.get(getRepositoryToken(Organization));
      const typeRepo = module.get(getRepositoryToken(CorrespondenceType));
      const disciplineRepo = module.get(getRepositoryToken(Discipline));
      const dataSource = module.get(DataSource);

      (projectRepo.findOne as jest.Mock).mockResolvedValue(mockProject);
      (orgRepo.findOne as jest.Mock).mockResolvedValue(mockOrg);
      (typeRepo.findOne as jest.Mock).mockResolvedValue(mockType);
      (disciplineRepo.findOne as jest.Mock).mockResolvedValue(mockDiscipline);
      (formatRepo.findOne as jest.Mock).mockResolvedValue({
        formatTemplate: '{SEQ:4}',
        resetSequenceYearly: true,
      });

      // Mock transaction to throw error
      (dataSource.transaction as jest.Mock).mockRejectedValue(
        new Error('Transaction failed')
      );

      service.onModuleInit();

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow(
        Error
      );
    });
  });
});
