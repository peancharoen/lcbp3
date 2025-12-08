import { Test, TestingModule } from '@nestjs/testing';
import { DocumentNumberingService } from './document-numbering.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, OptimisticLockVersionMismatchError } from 'typeorm';
import { InternalServerErrorException } from '@nestjs/common';
import { DocumentNumberCounter } from './entities/document-number-counter.entity';
import { DocumentNumberFormat } from './entities/document-number-format.entity';
import { Project } from '../project/entities/project.entity';
import { Organization } from '../project/entities/organization.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { Discipline } from '../master/entities/discipline.entity';
import { CorrespondenceSubType } from '../correspondence/entities/correspondence-sub-type.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity';
import { DocumentNumberError } from './entities/document-number-error.entity';

// Mock Redis and Redlock
const mockRedis = {
  disconnect: jest.fn(),
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
  let counterRepo: Repository<DocumentNumberCounter>;
  let formatRepo: Repository<DocumentNumberFormat>;
  let auditRepo: Repository<DocumentNumberAudit>;

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
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(DocumentNumberError),
          useValue: { save: jest.fn() },
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
      ],
    }).compile();

    service = module.get<DocumentNumberingService>(DocumentNumberingService);
    counterRepo = module.get(getRepositoryToken(DocumentNumberCounter));
    formatRepo = module.get(getRepositoryToken(DocumentNumberFormat));
    auditRepo = module.get(getRepositoryToken(DocumentNumberAudit));
  });

  afterEach(async () => {
    jest.clearAllMocks();
    service.onModuleDestroy();
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
        formatTemplate: '{SEQ}',
      });
      (counterRepo.findOne as jest.Mock).mockResolvedValue(null); // First time
      (counterRepo.save as jest.Mock).mockResolvedValue({ lastNumber: 1 });

      service.onModuleInit();

      const result = await service.generateNextNumber(mockContext);

      expect(result).toBe('000001'); // Default padding 6
      expect(counterRepo.save).toHaveBeenCalled();
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException if max retries exceeded', async () => {
      const projectRepo = module.get(getRepositoryToken(Project));
      const orgRepo = module.get(getRepositoryToken(Organization));
      const typeRepo = module.get(getRepositoryToken(CorrespondenceType));
      const disciplineRepo = module.get(getRepositoryToken(Discipline));

      (projectRepo.findOne as jest.Mock).mockResolvedValue(mockProject);
      (orgRepo.findOne as jest.Mock).mockResolvedValue(mockOrg);
      (typeRepo.findOne as jest.Mock).mockResolvedValue(mockType);
      (disciplineRepo.findOne as jest.Mock).mockResolvedValue(mockDiscipline);
      (formatRepo.findOne as jest.Mock).mockResolvedValue({
        formatTemplate: '{SEQ}',
      });
      (counterRepo.findOne as jest.Mock).mockResolvedValue({ lastNumber: 1 });

      // Always fail
      (counterRepo.save as jest.Mock).mockRejectedValue(
        new OptimisticLockVersionMismatchError('Counter', 1, 2)
      );

      service.onModuleInit();

      await expect(service.generateNextNumber(mockContext)).rejects.toThrow(
        InternalServerErrorException
      );
      expect(counterRepo.save).toHaveBeenCalledTimes(3); // Max retries
    });
  });
});
