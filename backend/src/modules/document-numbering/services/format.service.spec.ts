// File: backend/src/modules/document-numbering/services/format.service.spec.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for FormatService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormatService, FormatOptions } from './format.service';
import { DocumentNumberFormat } from '../entities/document-number-format.entity';
import { Project } from '../../project/entities/project.entity';
import { CorrespondenceType } from '../../correspondence/entities/correspondence-type.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Discipline } from '../../master/entities/discipline.entity';

describe('FormatService', () => {
  let service: FormatService;
  let formatRepo: Repository<DocumentNumberFormat>;
  let projectRepo: Repository<Project>;
  let typeRepo: Repository<CorrespondenceType>;
  let orgRepo: Repository<Organization>;
  let disciplineRepo: Repository<Discipline>;

  const mockFormatOptions: FormatOptions = {
    projectId: 1,
    correspondenceTypeId: 1,
    subTypeId: 1,
    rfaTypeId: 1,
    disciplineId: 1,
    sequence: 42,
    resetScope: 'YEAR_2025',
    year: 2025,
    originatorOrganizationId: 2,
    recipientOrganizationId: 3,
  };

  const mockSpecificFormat = {
    id: 1,
    projectId: 1,
    correspondenceTypeId: 1,
    formatTemplate: '{ORG}-{SEQ:4}/{YEAR:BE}',
    resetSequenceYearly: true,
  };

  const mockDefaultFormat = {
    id: 2,
    projectId: 1,
    correspondenceTypeId: null,
    formatTemplate: '{PROJECT}-{SEQ:4}',
    resetSequenceYearly: false,
  };

  const mockProject = { id: 1, projectCode: 'PROJ' };
  const mockType = { id: 1, typeCode: 'COR' };
  const mockOrg = { id: 2, organizationCode: 'GGL' };
  const mockRecipient = { id: 3, organizationCode: 'REC' };
  const mockDiscipline = { id: 1, disciplineCode: 'STR' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormatService,
        {
          provide: getRepositoryToken(DocumentNumberFormat),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Project),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CorrespondenceType),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Discipline),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FormatService>(FormatService);
    formatRepo = module.get<Repository<DocumentNumberFormat>>(
      getRepositoryToken(DocumentNumberFormat)
    );
    projectRepo = module.get<Repository<Project>>(getRepositoryToken(Project));
    typeRepo = module.get<Repository<CorrespondenceType>>(
      getRepositoryToken(CorrespondenceType)
    );
    orgRepo = module.get<Repository<Organization>>(
      getRepositoryToken(Organization)
    );
    disciplineRepo = module.get<Repository<Discipline>>(
      getRepositoryToken(Discipline)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('format', () => {
    it('should format with specific template', async () => {
      (formatRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(mockSpecificFormat)
        .mockResolvedValueOnce(null);
      (projectRepo.findOne as jest.Mock).mockResolvedValue(mockProject);
      (typeRepo.findOne as jest.Mock).mockResolvedValue(mockType);
      (orgRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRecipient)
        .mockResolvedValueOnce(mockOrg);
      (disciplineRepo.findOne as jest.Mock).mockResolvedValue(mockDiscipline);

      const result = await service.format(mockFormatOptions);

      expect(result.previewNumber).toContain('GGL');
      expect(result.previewNumber).toContain('0042');
      expect(result.isDefault).toBe(false);
    });

    it('should format with default template when specific not found', async () => {
      (formatRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockDefaultFormat);
      (projectRepo.findOne as jest.Mock).mockResolvedValue(mockProject);
      (typeRepo.findOne as jest.Mock).mockResolvedValue(mockType);
      (orgRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRecipient)
        .mockResolvedValueOnce(mockOrg);
      (disciplineRepo.findOne as jest.Mock).mockResolvedValue(mockDiscipline);

      const result = await service.format(mockFormatOptions);

      expect(result.previewNumber).toContain('PROJ');
      expect(result.isDefault).toBe(true);
    });

    it('should format with fallback template when no format found', async () => {
      (formatRepo.findOne as jest.Mock).mockResolvedValue(null);
      (projectRepo.findOne as jest.Mock).mockResolvedValue(mockProject);
      (typeRepo.findOne as jest.Mock).mockResolvedValue(mockType);
      (orgRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRecipient)
        .mockResolvedValueOnce(mockOrg);
      (disciplineRepo.findOne as jest.Mock).mockResolvedValue(mockDiscipline);

      const result = await service.format(mockFormatOptions);

      // Fallback template is {ORG}-{RECIPIENT}-{SEQ:4}/{YEAR:BE}
      expect(result.previewNumber).toContain('GGL');
      expect(result.previewNumber).toContain('REC');
      expect(result.previewNumber).toContain('0042');
      expect(result.isDefault).toBe(true);
    });

    it('should use current year when not provided', async () => {
      const optionsWithoutYear = { ...mockFormatOptions, year: undefined };
      (formatRepo.findOne as jest.Mock).mockResolvedValue(mockSpecificFormat);
      (projectRepo.findOne as jest.Mock).mockResolvedValue(mockProject);
      (typeRepo.findOne as jest.Mock).mockResolvedValue(mockType);
      (orgRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRecipient)
        .mockResolvedValueOnce(mockOrg);
      (disciplineRepo.findOne as jest.Mock).mockResolvedValue(mockDiscipline);

      const result = await service.format(optionsWithoutYear);

      // Year is converted to Thai year (BE)
      const currentYearBE = (new Date().getFullYear() + 543).toString();
      expect(result.previewNumber).toContain(currentYearBE);
    });

    it('should handle missing entities with defaults', async () => {
      (formatRepo.findOne as jest.Mock).mockResolvedValue(mockSpecificFormat);
      (projectRepo.findOne as jest.Mock).mockResolvedValue(null);
      (typeRepo.findOne as jest.Mock).mockResolvedValue(null);
      (orgRepo.findOne as jest.Mock).mockResolvedValue(null);
      (disciplineRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.format(mockFormatOptions);

      // Specific template {ORG}-{SEQ:4}/{YEAR:BE} uses defaults
      expect(result.previewNumber).toContain('GEN');
      expect(result.previewNumber).toContain('0042');
    });

    it('should handle missing recipientOrganizationId', async () => {
      const optionsWithoutRecipient = {
        ...mockFormatOptions,
        recipientOrganizationId: undefined,
      };
      (formatRepo.findOne as jest.Mock).mockResolvedValue(mockSpecificFormat);
      (projectRepo.findOne as jest.Mock).mockResolvedValue(mockProject);
      (typeRepo.findOne as jest.Mock).mockResolvedValue(mockType);
      (orgRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // recipient returns null
        .mockResolvedValueOnce(mockOrg); // originator returns mockOrg
      (disciplineRepo.findOne as jest.Mock).mockResolvedValue(mockDiscipline);

      const result = await service.format(optionsWithoutRecipient);

      // When recipient is missing, it defaults to 'GEN'
      expect(result.previewNumber).toContain('GEN');
    });
  });
});
